// End-to-end Fortnox connect + MCP flow against http://localhost:3000
// (requires the server booted with FORTNOX_MOCK=true).
// With FORTNOX_MOCK_TOKEN_TTL<=2 it additionally proves single-use
// refresh-token rotation is persisted by the shared token manager.
import { createHash, randomBytes, randomUUID } from "node:crypto";

const BASE = (process.argv[2] ?? process.env.E2E_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const MCP_BASE = (process.env.E2E_MCP_URL ?? BASE).replace(/\/$/, "");
const b64url = (buf) => buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const ORIGIN = { Origin: BASE };
const die = (msg, extra) => { console.error("FAIL:", msg, extra ?? ""); process.exit(1); };

// 1. Dynamic client registration (public client, like Claude/ChatGPT)
const redirectUri = "http://localhost:9999/callback";
let res = await fetch(`${BASE}/api/auth/oauth2/register`, {
  method: "POST",
  headers: { "Content-Type": "application/json", ...ORIGIN },
  body: JSON.stringify({
    client_name: "e2e-fortnox-client",
    redirect_uris: [redirectUri],
    token_endpoint_auth_method: "none",
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
  }),
});
if (!res.ok) die("DCR failed", await res.text());
const client = await res.json();
console.log("1. DCR ok, client_id:", client.client_id);

// 2. Create a user + session
const email = `e2e-fnx-${randomUUID().slice(0, 8)}@example.com`;
res = await fetch(`${BASE}/api/auth/sign-up/email`, {
  method: "POST",
  headers: { "Content-Type": "application/json", ...ORIGIN },
  body: JSON.stringify({ name: "E2E Fortnox Tester", email, password: "test-password-123" }),
});
if (!res.ok) die("sign-up failed", await res.text());
const cookie = res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
console.log("2. sign-up ok:", email);

// 3-5. Authorize with PKCE, approve consent, exchange the code
const verifier = b64url(randomBytes(32));
const challenge = b64url(createHash("sha256").update(verifier).digest());
const authUrl = new URL(`${BASE}/api/auth/oauth2/authorize`);
authUrl.search = new URLSearchParams({
  response_type: "code",
  client_id: client.client_id,
  redirect_uri: redirectUri,
  scope: "openid profile email offline_access accounting",
  state: "e2e-state",
  code_challenge: challenge,
  code_challenge_method: "S256",
  resource: `${MCP_BASE}/mcp`,
}).toString();
res = await fetch(authUrl, { redirect: "manual", headers: { cookie, Accept: "text/html" } });
let consentLocation = res.headers.get("location");
if (!consentLocation && res.status === 200) {
  const body = await res.json().catch(() => null);
  if (body?.redirect) consentLocation = body.url;
}
if (!consentLocation?.includes("/consent")) die(`expected redirect to /consent, got ${res.status}`, consentLocation);
const consentQuery = new URL(consentLocation, BASE).search.slice(1);
res = await fetch(`${BASE}/api/auth/oauth2/consent`, {
  method: "POST",
  headers: { "Content-Type": "application/json", cookie, ...ORIGIN },
  body: JSON.stringify({ accept: true, oauth_query: consentQuery }),
});
if (!res.ok) die("consent failed", await res.text());
const consentBody = await res.json();
const cb = new URL(consentBody.redirect_uri ?? consentBody.url);
const code = cb.searchParams.get("code");
if (!code) die("no code in callback", cb.toString());
res = await fetch(`${BASE}/api/auth/oauth2/token`, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: client.client_id,
    code_verifier: verifier,
    resource: `${MCP_BASE}/mcp`,
  }),
});
if (!res.ok) die("token exchange failed", await res.text());
const tokens = await res.json();
console.log("3-5. MCP OAuth ok (authorize → consent → tokens)");

// 6. MCP initialize
const mcpHeaders = {
  Authorization: `Bearer ${tokens.access_token}`,
  "Content-Type": "application/json",
  Accept: "application/json, text/event-stream",
};
res = await fetch(`${MCP_BASE}/mcp`, {
  method: "POST",
  headers: mcpHeaders,
  body: JSON.stringify({
    jsonrpc: "2.0", id: 1, method: "initialize",
    params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "e2e-fortnox", version: "0" } },
  }),
});
if (!res.ok) die("initialize failed", `${res.status} ${await res.text()}`);
const sessionId = res.headers.get("mcp-session-id");
if (!sessionId) die("no mcp-session-id header");
const sse = { ...mcpHeaders, "mcp-session-id": sessionId, "MCP-Protocol-Version": "2025-06-18" };
await fetch(`${MCP_BASE}/mcp`, {
  method: "POST", headers: sse,
  body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
});
const callTool = async (name, args = {}, id = 100) => {
  const r = await fetch(`${MCP_BASE}/mcp`, {
    method: "POST", headers: sse,
    body: JSON.stringify({ jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: args } }),
  });
  return r.text();
};
console.log("6. MCP initialize ok, session:", sessionId);

// 7. Connect a Fortnox company (mock): /connect/fortnox → mock auth → callback
res = await fetch(`${BASE}/connect/fortnox`, { redirect: "manual", headers: { cookie } });
if (res.status !== 302) die("connect/fortnox should redirect, got " + res.status, await res.text());
const fortnoxAuthUrl = res.headers.get("location");
const stateCookie = res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
if (!fortnoxAuthUrl?.includes("/oauth-v1/auth")) die("unexpected connect redirect", fortnoxAuthUrl);
if (!fortnoxAuthUrl.includes("access_type=offline")) die("authorize URL missing access_type=offline", fortnoxAuthUrl);
console.log("7. connect flow started → mock Fortnox authorize (access_type=offline)");

// 8. Pick the first company on the mock authorize page, follow callback
res = await fetch(fortnoxAuthUrl);
const pageHtml = await res.text();
const callbackUrl = /href="([^"]+)"/.exec(pageHtml)?.[1]?.replace(/&amp;/g, "&");
if (!callbackUrl) die("no company link on mock authorize page", pageHtml.slice(0, 300));
res = await fetch(callbackUrl, { redirect: "manual", headers: { cookie: `${cookie}; ${stateCookie}` } });
if (res.status !== 302 || !res.headers.get("location")?.includes("/dashboard")) {
  die("callback should redirect to /dashboard, got " + res.status, await res.text());
}
console.log("8. mock Fortnox company connected");

// 9. list_companies shows the connected company with provider fortnox
const companiesText = await callTool("list_companies", {}, 2);
if (!companiesText.includes("Fortnox Testbolag AB")) die("list_companies missing Fortnox company", companiesText);
if (!companiesText.includes("fortnox")) die("list_companies missing provider fortnox", companiesText);
console.log("9. list_companies shows: Fortnox Testbolag AB (fortnox)");

// 10. tools/list — per-provider write toggle must filter fortnox mutating tools
res = await fetch(`${MCP_BASE}/mcp`, {
  method: "POST", headers: sse,
  body: JSON.stringify({ jsonrpc: "2.0", id: 3, method: "tools/list" }),
});
const toolsText = await res.text();
const toolNames = [...toolsText.matchAll(/"name":"([\w-]+)"/g)].map((m) => m[1]);
const statusText = await callTool("get_connection_status", {}, 4);
const writesEnabled = /writesEnabled\\?":\s*\{[^}]*"fortnox\\?":\s*true/.test(statusText);
const hasWrite = toolNames.includes("fortnox_invoices_create");
if (!toolNames.includes("fortnox_invoices_list")) die("fortnox_invoices_list missing from tools/list");
if (hasWrite !== writesEnabled) {
  die(`write-toggle mismatch: fortnox writesEnabled=${writesEnabled} but create tool ${hasWrite ? "present" : "absent"}`);
}
console.log(`10. tools/list ok (${toolNames.length} tools, fortnox writesEnabled=${writesEnabled})`);

// 11. Company information through the generated client
const infoText = await callTool("fortnox_company_information_list", {}, 5);
if (!infoText.includes("Fortnox Testbolag AB")) die("companyinformation failed", infoText.slice(0, 400));
console.log("11. fortnox_company_information_list ok");

// 12. List invoices fixture
const invText = await callTool("fortnox_invoices_list", {}, 6);
if (!invText.includes("Acme AB")) die("fortnox_invoices_list failed", invText.slice(0, 400));
console.log("12. fortnox_invoices_list ok");

// 13. Binary SIE download returns a base64 resource
const sieText = await callTool("fortnox_sie_get", { Type: "4" }, 7);
const blobMatch = /"blob":"([A-Za-z0-9+/=]+)"/.exec(sieText);
if (!blobMatch || !Buffer.from(blobMatch[1], "base64").toString().includes("#FLAGGA")) {
  die("SIE download failed", sieText.slice(0, 400));
}
console.log("13. fortnox_sie_get ok (valid SIE header in blob)");

// 14. Write toggle behavior on a mutating tool
if (!writesEnabled) {
  const writeText = await callTool("fortnox_invoices_create", { body: { Invoice: { CustomerNumber: "1" } } }, 8);
  if (!/not found|unknown/i.test(writeText)) die("write tool should be unavailable", writeText.slice(0, 300));
  console.log("14. write tool correctly unavailable with FORTNOX_ALLOW_WRITES=false");
} else {
  const writeText = await callTool("fortnox_invoices_create", { body: { Invoice: { CustomerNumber: "1" } } }, 8);
  if (!writeText.includes("DocumentNumber")) die("fortnox_invoices_create failed", writeText.slice(0, 300));
  console.log("14. fortnox_invoices_create ok (writes enabled)");
}

// 15. Refresh-rotation regression: with a short mock token TTL, back-to-back
// tool calls straddle an expiry, forcing a refresh whose rotated (single-use)
// refresh token must be persisted — a second refresh only works if it was.
const ttl = Number(process.env.FORTNOX_MOCK_TOKEN_TTL ?? "3600");
if (ttl <= 2) {
  await new Promise((resolve) => setTimeout(resolve, ttl * 1000 + 200));
  const first = await callTool("fortnox_customers_list", {}, 9);
  if (!first.includes("Acme AB")) die("post-expiry call 1 failed (refresh broken?)", first.slice(0, 400));
  await new Promise((resolve) => setTimeout(resolve, ttl * 1000 + 200));
  const second = await callTool("fortnox_customers_list", {}, 10);
  if (!second.includes("Acme AB")) {
    die("post-expiry call 2 failed — rotated refresh token was not persisted", second.slice(0, 400));
  }
  console.log("15. refresh rotation persisted across two expiries");
} else {
  console.log("15. (skipped rotation check — set FORTNOX_MOCK_TOKEN_TTL=1 to enable)");
}

console.log("\nALL OK");
