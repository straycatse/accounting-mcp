// Probes which Fortnox scopes this integration is actually allowed to request.
//
// Fortnox rejects the whole authorize request with `invalid_scope` if *any*
// requested scope isn't enabled for the integration, without saying which one.
// This asks for each scope on its own so the offender is identifiable.
//
// Usage:
//   FORTNOX_CLIENT_ID=... FORTNOX_REDIRECT_URI=https://.../connect/fortnox/callback \
//     node scripts/probe-fortnox-scopes.mjs
//
// Nothing is authorized: we stop at the redirect Fortnox issues before login,
// so this neither creates a connection nor consumes anything.
const clientId = process.env.FORTNOX_CLIENT_ID;
const redirectUri = process.env.FORTNOX_REDIRECT_URI;
const authBase = process.env.FORTNOX_AUTH_BASE_URL ?? "https://apps.fortnox.se/oauth-v1";

if (!clientId || !redirectUri) {
  console.error(
    "Set FORTNOX_CLIENT_ID and FORTNOX_REDIRECT_URI (must exactly match a redirect URI\nregistered for the integration, or every probe fails for that reason instead).",
  );
  process.exit(1);
}

// The scopes we ask for today, plus the ones we deliberately skip — knowing
// whether those are available is useful when deciding to widen the tool set.
const REQUESTED = [
  "companyinformation", "bookkeeping", "invoice", "customer", "supplier",
  "supplierinvoice", "article", "archive", "inbox", "order", "offer",
  "project", "price", "costcenter", "currency", "settings", "connectfile",
  "payment", "print",
];
const NOT_REQUESTED = [
  "assets", "salary", "timereporting", "noxfinansinvoice", "profile",
];

async function probe(scope) {
  const url = new URL(`${authBase}/auth`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", scope);
  url.searchParams.set("state", "probe");
  url.searchParams.set("access_type", "offline");

  const res = await fetch(url, { redirect: "manual" });
  const location = res.headers.get("location") ?? "";
  const error = new URL(location, authBase).searchParams.get("error");
  if (error) return { ok: false, detail: error };
  // No error param → Fortnox accepted the scope and moved on to login/consent.
  return { ok: true, detail: `${res.status}` };
}

const results = [];
for (const scope of [...REQUESTED, ...NOT_REQUESTED]) {
  try {
    const { ok, detail } = await probe(scope);
    results.push({ scope, ok, detail, requested: REQUESTED.includes(scope) });
  } catch (err) {
    results.push({ scope, ok: false, detail: `probe failed: ${err.message}`, requested: REQUESTED.includes(scope) });
  }
}

const pad = (s) => s.padEnd(20);
console.log("\nScopes we request today:");
for (const r of results.filter((r) => r.requested))
  console.log(`  ${r.ok ? "OK     " : "REJECT "} ${pad(r.scope)} ${r.ok ? "" : r.detail}`);
console.log("\nScopes we deliberately skip (paid add-on modules):");
for (const r of results.filter((r) => !r.requested))
  console.log(`  ${r.ok ? "avail  " : "n/a    "} ${pad(r.scope)} ${r.ok ? "" : r.detail}`);

const bad = results.filter((r) => r.requested && !r.ok).map((r) => r.scope);
console.log(
  bad.length
    ? `\n${bad.length} requested scope(s) rejected: ${bad.join(" ")}\n` +
      `Tick the matching permission at apps.fortnox.se, or drop them from FORTNOX_SCOPES.`
    : "\nAll requested scopes accepted individually — if the combined request still\n" +
      "fails, the redirect_uri or client_id is the problem, not the scopes.",
);
