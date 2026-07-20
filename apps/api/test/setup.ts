// Minimal env so src/config.ts validates in unit tests (no DB is contacted
// unless a test does so explicitly).
process.env.NODE_ENV = "test";
// Vite/vitest exports its own BASE_URL ("/") into process.env — restore ours.
if (!process.env.BASE_URL?.startsWith("http")) {
  process.env.BASE_URL = "http://localhost:3000";
}
process.env.DATABASE_URL ??= "postgres://accounting:accounting@localhost:5433/accounting_mcp";
process.env.BETTER_AUTH_SECRET ??= "test-secret-test-secret-test-secret-12";
process.env.TOKEN_ENCRYPTION_KEY ??= Buffer.alloc(32, 7).toString("base64");
process.env.BOKIO_MOCK ??= "true";
process.env.FORTNOX_MOCK ??= "true";
