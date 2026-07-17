// End-to-end test of the private-integration-token connect + disconnect paths
// against the mock Bokio. Runs with BOKIO_MOCK=true and billing disabled.
import { randomUUID } from "node:crypto";

const BASE = (process.argv[2] ?? process.env.E2E_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const ORIGIN = { Origin: BASE };
const die = (msg, extra) => { console.error("FAIL:", msg, extra ?? ""); process.exit(1); };

const MOCK_COMPANY = "11111111-1111-4111-8111-111111111111";
const MOCK_TOKEN = `mock-pi-${MOCK_COMPANY}`;

// 1. Sign up a user
const email = `pi-${randomUUID().slice(0, 8)}@example.com`;
let res = await fetch(`${BASE}/api/auth/sign-up/email`, {
  method: "POST",
  headers: { "Content-Type": "application/json", ...ORIGIN },
  body: JSON.stringify({ name: "PI Tester", email, password: "test-password-123" }),
});
if (!res.ok) die("sign-up failed", await res.text());
const cookie = res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
console.log("1. sign-up ok:", email);

const post = (path, body) =>
  fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie, ...ORIGIN },
    body: JSON.stringify(body),
  });

// 2. A bad token must be rejected (validated against the API)
res = await post("/connect/bokio/token", { integrationToken: "not-a-real-token", companyId: MOCK_COMPANY });
if (res.status !== 400) die("bad token should be rejected with 400, got " + res.status, await res.text());
console.log("2. invalid token rejected (400)");

// 3. Missing fields rejected
res = await post("/connect/bokio/token", { integrationToken: MOCK_TOKEN });
if (res.status !== 400) die("missing companyId should be 400, got " + res.status);
console.log("3. missing companyId rejected (400)");

// 4. Valid token connects, returns the resolved company name
res = await post("/connect/bokio/token", { integrationToken: MOCK_TOKEN, companyId: MOCK_COMPANY });
if (!res.ok) die("token connect failed", await res.text());
const connected = await res.json();
if (connected.companyName !== "Testbolaget AB") die("unexpected company name", JSON.stringify(connected));
console.log("4. token connect ok →", connected.companyName);

// 5. It shows up in /api/connections as an integration_token connection
res = await fetch(`${BASE}/api/connections`, { headers: { cookie } });
let { connections } = await res.json();
const conn = connections.find((x) => x.tenantId === MOCK_COMPANY);
if (!conn) die("connection missing from list", JSON.stringify(connections));
if (conn.authType !== "integration_token") die("wrong authType", conn.authType);
console.log("5. listed as", conn.authType, "connection");

// (Tool calls through an integration_token connection are covered by the main
// e2e, which has a live MCP session — see e2e-oauth.mjs. Here we cover the
// connect/validate/disconnect HTTP surface.)

// 6. Disconnect it
res = await post("/connect/bokio/disconnect", { id: conn.id });
if (!res.ok) die("disconnect failed", await res.text());
console.log("6. disconnect ok");

// 8. Gone from the list; disconnecting again 404s
res = await fetch(`${BASE}/api/connections`, { headers: { cookie } });
({ connections } = await res.json());
if (connections.find((x) => x.tenantId === MOCK_COMPANY)) die("connection still present after disconnect");
res = await post("/connect/bokio/disconnect", { id: conn.id });
if (res.status !== 404) die("re-disconnect should 404, got " + res.status);
console.log("7. removed from list; re-disconnect 404s");

// 9. Cross-user isolation: another user can't disconnect the first user's row
const email2 = `pi2-${randomUUID().slice(0, 8)}@example.com`;
res = await fetch(`${BASE}/api/auth/sign-up/email`, {
  method: "POST",
  headers: { "Content-Type": "application/json", ...ORIGIN },
  body: JSON.stringify({ name: "Other", email: email2, password: "test-password-123" }),
});
const cookie2 = res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
// user1 reconnects
res = await post("/connect/bokio/token", { integrationToken: MOCK_TOKEN, companyId: MOCK_COMPANY });
const reconn = await res.json();
res = await fetch(`${BASE}/api/connections`, { headers: { cookie } });
({ connections } = await res.json());
const rowId = connections.find((x) => x.tenantId === MOCK_COMPANY).id;
void reconn;
// user2 tries to delete user1's row id
res = await fetch(`${BASE}/connect/bokio/disconnect`, {
  method: "POST",
  headers: { "Content-Type": "application/json", cookie: cookie2, ...ORIGIN },
  body: JSON.stringify({ id: rowId }),
});
if (res.status !== 404) die("cross-user disconnect must 404, got " + res.status);
// confirm user1 still has it
res = await fetch(`${BASE}/api/connections`, { headers: { cookie } });
({ connections } = await res.json());
if (!connections.find((x) => x.id === rowId)) die("user1 lost their connection to a cross-user delete");
console.log("8. cross-user disconnect blocked (404), owner unaffected");

console.log("\nALL OK (token connect + disconnect)");
