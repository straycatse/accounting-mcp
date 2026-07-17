import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import { html } from "hono/html";
import {
  MOCK_CLIENT_ID,
  MOCK_CLIENT_SECRET,
  authCodes,
  companies,
  issueTokens,
  paged,
  refreshTokens,
  resolveBearer,
  tenantFixtures,
} from "./state.js";

const apiError = (code: string, message: string) => ({
  code,
  message,
  bokioErrorId: randomUUID(),
});

// Mock of Bokio's OAuth endpoints + a fixture subset of the Company API,
// mounted at /mock/bokio/v1 when BOKIO_MOCK=true. Shapes follow specs/*.yaml.
export const mockBokio = new Hono();

mockBokio.get("/authorize", (c) => {
  const { client_id, redirect_uri, state, response_type } = c.req.query();
  if (response_type !== "code" || client_id !== MOCK_CLIENT_ID || !redirect_uri || !state) {
    return c.json({ error: "invalid_request", error_description: "bad authorize params" }, 400);
  }
  const pick = (tenantId: string) => {
    const code = `mock-code-${randomUUID()}`;
    authCodes.set(code, { tenantId, redirectUri: redirect_uri, expiresAt: Date.now() + 5 * 60_000 });
    const url = new URL(redirect_uri);
    url.searchParams.set("code", code);
    url.searchParams.set("state", state);
    return url.toString();
  };
  return c.html(html`<!doctype html>
    <html>
      <head><title>Mock Bokio — Authorize</title></head>
      <body style="font-family: system-ui; max-width: 26rem; margin: 4rem auto;">
        <h1>Mock Bokio</h1>
        <p>Choose a company to authorize for the integration:</p>
        ${companies.map(
          (company) => html`<p><a href="${pick(company.id)}">${company.name} (${company.organizationNumber})</a></p>`,
        )}
      </body>
    </html>`);
});

mockBokio.post("/token", async (c) => {
  const basic = c.req.header("authorization");
  const expected = `Basic ${Buffer.from(`${MOCK_CLIENT_ID}:${MOCK_CLIENT_SECRET}`).toString("base64")}`;
  if (basic !== expected) {
    return c.json({ error: "invalid_client", error_description: "bad Basic credentials" }, 401);
  }
  const body = await c.req.parseBody();
  const grantType = body["grant_type"];

  if (grantType === "authorization_code") {
    const code = String(body["code"] ?? "");
    const entry = authCodes.get(code);
    authCodes.delete(code); // single use
    if (!entry || entry.expiresAt < Date.now()) {
      return c.json({ error: "invalid_grant", error_description: "unknown or expired code" }, 400);
    }
    return c.json(issueTokens(entry.tenantId));
  }

  if (grantType === "refresh_token") {
    const token = String(body["refresh_token"] ?? "");
    const entry = refreshTokens.get(token);
    if (!entry) {
      return c.json({ error: "invalid_grant", error_description: "unknown refresh token" }, 400);
    }
    refreshTokens.delete(token); // rotation: old refresh token is invalidated
    return c.json(issueTokens(entry.tenantId));
  }

  return c.json({ error: "unsupported_grant_type" }, 400);
});

// --- Company API fixture subset (bearer-authenticated, tenant-isolated) ---

mockBokio.use("/companies/*", async (c, next) => {
  const company = resolveBearer(c.req.header("authorization"));
  if (!company) return c.json(apiError("unauthorized", "Invalid or expired access token"), 401);
  const requested = c.req.param("companyId") ?? c.req.path.split("/companies/")[1]?.split("/")[0];
  if (requested && requested !== company.id) {
    return c.json(apiError("forbidden", "Token is not valid for this company"), 403);
  }
  c.set("mockCompany" as never, company as never);
  await next();
});

mockBokio.get("/companies/:companyId/invoices", (c) => {
  const data = tenantFixtures(c.req.param("companyId"));
  const q = c.req.query("query")?.toLowerCase();
  const items = q
    ? data.invoices.filter((i) => JSON.stringify(i).toLowerCase().includes(q))
    : data.invoices;
  return c.json(paged(items));
});

mockBokio.get("/companies/:companyId/invoices/:invoiceId", (c) => {
  const data = tenantFixtures(c.req.param("companyId"));
  const invoice = data.invoices.find((i) => i.id === c.req.param("invoiceId"));
  if (!invoice) return c.json(apiError("not-found", "Invoice not found"), 404);
  return c.json({ invoice });
});

mockBokio.post("/companies/:companyId/invoices", async (c) => {
  const data = tenantFixtures(c.req.param("companyId"));
  const body = await c.req.json<Record<string, unknown>>();
  const invoice = {
    id: randomUUID(),
    invoiceNumber: String(1000 + data.invoices.length + 1),
    status: "draft",
    currency: "SEK",
    totalAmount: 0,
    customerRef: { id: "" },
    lineItems: [],
    ...body,
  } as unknown as (typeof data.invoices)[number];
  data.invoices.push(invoice);
  return c.json({ invoice }, 201);
});

mockBokio.get("/companies/:companyId/customers", (c) =>
  c.json(paged(tenantFixtures(c.req.param("companyId")).customers)),
);

mockBokio.post("/companies/:companyId/customers", async (c) => {
  const data = tenantFixtures(c.req.param("companyId"));
  const body = await c.req.json<Record<string, unknown>>();
  const customer = { id: randomUUID(), ...body } as (typeof data.customers)[number];
  data.customers.push(customer);
  return c.json({ customer }, 201);
});

mockBokio.get("/companies/:companyId/journal-entries", (c) =>
  c.json(paged(tenantFixtures(c.req.param("companyId")).journalEntries)),
);

mockBokio.get("/companies/:companyId/journal-entries/:journalEntryId", (c) => {
  const data = tenantFixtures(c.req.param("companyId"));
  const entry = data.journalEntries.find((e) => e.id === c.req.param("journalEntryId"));
  if (!entry) return c.json(apiError("not-found", "Journal entry not found"), 404);
  return c.json({ journalEntry: entry });
});

mockBokio.post("/companies/:companyId/journal-entries", async (c) => {
  const data = tenantFixtures(c.req.param("companyId"));
  const body = await c.req.json<Record<string, unknown>>();
  const entry = {
    id: randomUUID(),
    journalEntryNumber: `V${data.journalEntries.length + 1}`,
    ...body,
  } as (typeof data.journalEntries)[number];
  data.journalEntries.push(entry);
  return c.json({ journalEntry: entry }, 201);
});

mockBokio.get("/companies/:companyId/chart-of-accounts", (c) =>
  c.json({ accounts: tenantFixtures(c.req.param("companyId")).accounts }),
);

mockBokio.get("/companies/:companyId/chart-of-accounts/:account", (c) => {
  const data = tenantFixtures(c.req.param("companyId"));
  const account = data.accounts.find((a) => String(a.account) === c.req.param("account"));
  if (!account) return c.json(apiError("not-found", "Account not found"), 404);
  return c.json({ account });
});

mockBokio.get("/companies/:companyId/fiscal-years", (c) =>
  c.json(paged(tenantFixtures(c.req.param("companyId")).fiscalYears)),
);

mockBokio.get("/companies/:companyId/sie/:fiscalYearId/download", (c) => {
  const company = companies.find((x) => x.id === c.req.param("companyId"))!;
  const sie = [
    '#FLAGGA 0',
    '#PROGRAM "accounting-mcp mock" 1.0',
    '#FORMAT PC8',
    `#FNAMN "${company.name}"`,
    `#ORGNR ${company.organizationNumber}`,
    '#RAR 0 20260101 20261231',
    '#KONTO 1930 "Företagskonto"',
    '#VER V 1 20260502 "Kundfaktura 1001"',
  ].join("\n");
  return c.body(sie, 200, { "Content-Type": "application/octet-stream" });
});

mockBokio.get("/companies/:companyId/company-information", (c) => {
  const company = companies.find((x) => x.id === c.req.param("companyId"))!;
  return c.json({
    companyInformation: {
      id: company.id,
      companyType: company.companyType,
      name: company.name,
      organizationNumber: company.organizationNumber,
      phone: "+46701234567",
      email: company.email,
      hasBBA: true,
      address: {
        line1: "Testgatan 1",
        line2: null,
        city: "Göteborg",
        postalCode: "411 01",
        country: "SE",
      },
    },
  });
});
