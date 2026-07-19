// End-to-end MCP OAuth flow test against http://localhost:3000
import { createHash, randomBytes, randomUUID } from "node:crypto";

const BASE = (process.argv[2] ?? process.env.E2E_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
// The MCP endpoint (and OAuth resource/audience) always lives on the API
// origin, even when BASE points at the web proxy — mirroring real MCP clients.
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
    client_name: "e2e-test-client",
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
const email = `e2e-${randomUUID().slice(0, 8)}@example.com`;
res = await fetch(`${BASE}/api/auth/sign-up/email`, {
  method: "POST",
  headers: { "Content-Type": "application/json", ...ORIGIN },
  body: JSON.stringify({ name: "E2E Tester", email, password: "test-password-123" }),
});
if (!res.ok) die("sign-up failed", await res.text());
const cookie = res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
console.log("2. sign-up ok:", email);

// 3. Authorize with PKCE — expect redirect to consent page
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
// Canary: the consent page must live on the web origin. The oauth-provider
// plugin uses our configured consentPage URL verbatim (undocumented behavior,
// pinned exactly in package.json) — fail loudly if an upgrade changes that.
const expectedWebUrl = process.env.E2E_WEB_URL;
if (expectedWebUrl && !consentLocation.startsWith(expectedWebUrl)) {
  die(`consent redirect should target WEB_URL ${expectedWebUrl}`, consentLocation);
}
console.log("3. authorize ok → consent page");

// 4. Approve consent
const consentQuery = new URL(consentLocation, BASE).search.slice(1);
res = await fetch(`${BASE}/api/auth/oauth2/consent`, {
  method: "POST",
  headers: { "Content-Type": "application/json", cookie, ...ORIGIN },
  body: JSON.stringify({ accept: true, oauth_query: consentQuery }),
});
if (!res.ok) die("consent failed", await res.text());
const consentBody = await res.json();
const cbUrl = consentBody.redirect_uri ?? consentBody.url;
if (!cbUrl) die("consent response missing redirect", JSON.stringify(consentBody));
const cb = new URL(cbUrl);
const code = cb.searchParams.get("code");
if (!code) die("no code in callback", cbUrl);
if (cb.searchParams.get("state") !== "e2e-state") die("state mismatch", cbUrl);
console.log("4. consent ok, code received");

// 5. Token exchange (public client + PKCE)
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
if (!tokens.access_token) die("no access_token", tokens);
console.log("5. token exchange ok (expires_in:", tokens.expires_in + ", refresh:", !!tokens.refresh_token + ")");

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
    params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "e2e", version: "0" } },
  }),
});
if (!res.ok) die("initialize failed", `${res.status} ${await res.text()}`);
const sessionId = res.headers.get("mcp-session-id");
if (!sessionId) die("no mcp-session-id header");
console.log("6. MCP initialize ok, session:", sessionId);

// 7. Call the ping tool
const sse = { ...mcpHeaders, "mcp-session-id": sessionId, "MCP-Protocol-Version": "2025-06-18" };
const callTool = async (name, args = {}, id = 100) => {
  const r = await fetch(`${MCP_BASE}/mcp`, {
    method: "POST", headers: sse,
    body: JSON.stringify({ jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: args } }),
  });
  return r.text();
};
await fetch(`${MCP_BASE}/mcp`, {
  method: "POST", headers: sse,
  body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
});
res = await fetch(`${MCP_BASE}/mcp`, {
  method: "POST", headers: sse,
  body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "ping", arguments: {} } }),
});
const text = await res.text();
if (!text.includes("pong")) die("ping tool failed", text);
console.log("7. ping tool ok:", /"text":"([^"]*)"/.exec(text)?.[1]);

// 8. Wrong-token rejection: unauthenticated request with session id must 401
res = await fetch(`${MCP_BASE}/mcp`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", "mcp-session-id": sessionId },
  body: JSON.stringify({ jsonrpc: "2.0", id: 3, method: "tools/list" }),
});
if (res.status !== 401) die("expected 401 without token, got " + res.status);
console.log("8. unauthenticated re-use rejected (401)");

// Billing-blocked mode: server booted with BILLING_ENABLED=true and this user
// has no subscription, so checkout is required *before* connecting a company —
// the connect flow must bounce to the dashboard rather than reach Bokio.
if (process.env.E2E_BILLING_BLOCKED === "true") {
  res = await fetch(`${BASE}/connect/bokio`, { redirect: "manual", headers: { cookie } });
  const loc = res.headers.get("location") ?? "";
  if (res.status !== 302 || !loc.includes("billing=required")) {
    die(`connect should bounce to dashboard when unsubscribed (got ${res.status})`, loc);
  }
  if (loc.includes("/authorize")) die("connect reached Bokio despite no subscription", loc);
  console.log("9. /connect/bokio blocked before checkout →", loc);

  // Meta tools stay ungated so the user can always diagnose why they're stuck.
  const statusText = await callTool("get_connection_status", {}, 6);
  const flat = statusText.replace(/\\/g, "");
  if (!/"subscribed": ?false/.test(flat)) die("get_connection_status should report unsubscribed", flat.slice(0, 300));
  console.log("10. get_connection_status reports unsubscribed (ungated)");

  // And a company tool must name the subscription as the blocker.
  const toolText = await callTool("bokio_get_company_information", {}, 7);
  if (!/free trial|requires a subscription/i.test(toolText)) {
    die("expected subscription_required error from company tool", toolText.slice(0, 300));
  }
  console.log("11. company tools report subscription required");
  console.log("\nALL OK (billing-blocked mode)");
  process.exit(0);
}

// 9. Connect a Bokio company (mock): /connect/bokio → mock authorize → callback
res = await fetch(`${BASE}/connect/bokio`, { redirect: "manual", headers: { cookie } });
if (res.status !== 302) die("connect/bokio should redirect, got " + res.status, await res.text());
const bokioAuthorizeUrl = res.headers.get("location");
const stateCookie = res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
if (!bokioAuthorizeUrl?.includes("/authorize")) die("unexpected connect redirect", bokioAuthorizeUrl);
console.log("9. connect flow started → mock Bokio authorize");

// 10. Pick the first company on the mock authorize page, follow callback
res = await fetch(bokioAuthorizeUrl);
const pageHtml = await res.text();
const callbackUrl = /href="([^"]+)"/.exec(pageHtml)?.[1]?.replace(/&amp;/g, "&");
if (!callbackUrl) die("no company link on mock authorize page", pageHtml.slice(0, 300));
res = await fetch(callbackUrl, { redirect: "manual", headers: { cookie: `${cookie}; ${stateCookie}` } });
if (res.status !== 302 || !res.headers.get("location")?.includes("/dashboard")) {
  die("callback should redirect to /dashboard, got " + res.status, await res.text());
}
console.log("10. mock company connected");

// 11. list_companies through MCP shows the connected company
res = await fetch(`${MCP_BASE}/mcp`, {
  method: "POST", headers: sse,
  body: JSON.stringify({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "list_companies", arguments: {} } }),
});
const companiesText = await res.text();
if (!companiesText.includes("Testbolaget AB")) die("list_companies missing connected company", companiesText);
console.log("11. list_companies shows: Testbolaget AB");

// 12. tools/list — write toggle must filter mutating tools from the listing
res = await fetch(`${MCP_BASE}/mcp`, {
  method: "POST", headers: sse,
  body: JSON.stringify({ jsonrpc: "2.0", id: 5, method: "tools/list" }),
});
const toolsText = await res.text();
const toolNames = [...toolsText.matchAll(/"name":"([\w-]+)"/g)].map((m) => m[1]);
const statusText = await callTool("get_connection_status", {}, 6);
const writesEnabled = /writesEnabled\\?": ?true/.test(statusText);
const hasWrite = toolNames.includes("bokio_create_invoice");
if (!toolNames.includes("bokio_list_invoices")) die("bokio_list_invoices missing from tools/list");
if (hasWrite !== writesEnabled) {
  die(`write-toggle mismatch: writesEnabled=${writesEnabled} but create tool ${hasWrite ? "present" : "absent"}`);
}
console.log(`12. tools/list ok (${toolNames.length} tools, writesEnabled=${writesEnabled})`);

// 13. Company information through the generated client
const infoText = await callTool("bokio_get_company_information", {}, 7);
if (!infoText.includes("Testbolaget AB")) die("company-information failed", infoText);
console.log("13. bokio_get_company_information ok");

// 14. List invoices fixture
const invText = await callTool("bokio_list_invoices", {}, 8);
if (!invText.includes("Konsulttimmar maj")) die("list_invoices failed", invText);
console.log("14. bokio_list_invoices ok");

// 15. Binary SIE download returns a base64 resource
const sieText = await callTool("bokio_download_sie", { fiscalYearId: "ffff0002-0000-4000-8000-000000000002" }, 9);
const blobMatch = /"blob":"([A-Za-z0-9+/=]+)"/.exec(sieText);
if (!blobMatch || !Buffer.from(blobMatch[1], "base64").toString().includes("#FLAGGA")) {
  die("SIE download failed", sieText.slice(0, 400));
}
console.log("15. bokio_download_sie ok (valid SIE header in blob)");

// 16. When writes are disabled, calling a write tool must fail as unknown
if (!writesEnabled) {
  const writeText = await callTool("bokio_create_invoice", { body: { invoiceDate: "2026-07-17", lineItems: [] } }, 10);
  if (!/not found|unknown/i.test(writeText)) die("write tool should be unavailable", writeText.slice(0, 300));
  console.log("16. write tool correctly unavailable with BOKIO_ALLOW_WRITES=false");
} else {
  const writeText = await callTool("bokio_create_invoice", { body: { invoiceDate: "2026-07-17", lineItems: [] } }, 10);
  if (!writeText.includes("draft")) die("create_invoice failed", writeText.slice(0, 300));
  console.log("16. bokio_create_invoice ok (writes enabled)");
}

// 17. Connect a SECOND company via a private integration token (no OAuth), then
// call a tool against it by companyId — proving the token-manager's no-refresh
// path serves tools. (Billing is off in this run, so seats don't gate it.)
const secondCompany = "22222222-2222-4222-8222-222222222222";
res = await fetch(`${BASE}/connect/bokio/token`, {
  method: "POST",
  headers: { "Content-Type": "application/json", cookie, Origin: BASE },
  body: JSON.stringify({ integrationToken: `mock-pi-${secondCompany}`, companyId: secondCompany }),
});
if (!res.ok) die("token connect failed", await res.text());
const listAfter = await callTool("list_companies", {}, 11);
if (!listAfter.includes("Demo Consulting HB")) die("token-connected company missing", listAfter);
const infoByCompany = await callTool("bokio_get_company_information", { companyId: secondCompany }, 12);
if (!infoByCompany.includes("Demo Consulting HB")) die("tool call via integration token failed", infoByCompany);
console.log("17. private-integration-token company works through MCP (Demo Consulting HB)");

console.log("\nALL OK");
