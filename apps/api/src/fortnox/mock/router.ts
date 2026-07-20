import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import { html } from "hono/html";
import {
  MOCK_CLIENT_ID,
  MOCK_CLIENT_SECRET,
  authCodes,
  companies,
  envelope,
  issueTokens,
  refreshTokens,
  resolveBearer,
  tenantFixtures,
  type MockFortnoxCompany,
} from "./state.js";

const errorInformation = (code: number, message: string) => ({
  ErrorInformation: { Error: 1, Message: message, Code: code },
});

// Mock of Fortnox's OAuth endpoints (apps.fortnox.se/oauth-v1) + a fixture
// subset of the API (api.fortnox.se), mounted at /mock/fortnox when
// FORTNOX_MOCK=true. Note: no company segment in API paths — the bearer token
// alone selects the tenant, exactly like the real Fortnox API.
export const mockFortnox = new Hono();

mockFortnox.get("/oauth-v1/auth", (c) => {
  const { client_id, redirect_uri, state, response_type } = c.req.query();
  if (response_type !== "code" || client_id !== MOCK_CLIENT_ID || !redirect_uri || !state) {
    return c.json({ error: "invalid_request", error_description: "bad authorize params" }, 400);
  }
  const pick = (tenantId: string) => {
    const code = `mock-fnx-code-${randomUUID()}`;
    authCodes.set(code, { tenantId, redirectUri: redirect_uri, expiresAt: Date.now() + 5 * 60_000 });
    const url = new URL(redirect_uri);
    url.searchParams.set("code", code);
    url.searchParams.set("state", state);
    return url.toString();
  };
  return c.html(html`<!doctype html>
    <html>
      <head><title>Mock Fortnox — Authorize</title></head>
      <body style="font-family: system-ui; max-width: 26rem; margin: 4rem auto;">
        <h1>Mock Fortnox</h1>
        <p>Choose a company to authorize for the integration:</p>
        ${companies.map(
          (company) =>
            html`<p><a href="${pick(company.databaseNumber)}">${company.name} (${company.organizationNumber})</a></p>`,
        )}
      </body>
    </html>`);
});

mockFortnox.post("/oauth-v1/token", async (c) => {
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
    refreshTokens.delete(token); // rotation: Fortnox refresh tokens are single-use
    return c.json(issueTokens(entry.tenantId));
  }

  return c.json({ error: "unsupported_grant_type" }, 400);
});

// --- API fixture subset (bearer-authenticated; tenant comes from the token) ---

mockFortnox.use("/3/*", async (c, next) => {
  const company = resolveBearer(c.req.header("authorization"));
  if (!company) return c.json(errorInformation(2000310, "Invalid or expired access token"), 401);
  c.set("company" as never, company as never);
  await next();
});

const companyOf = (c: { get: (k: never) => unknown }) => c.get("company" as never) as MockFortnoxCompany;

mockFortnox.get("/3/companyinformation", (c) => {
  const company = companyOf(c);
  return c.json({
    CompanyInformation: {
      Address: "Testgatan 1",
      City: "Göteborg",
      CompanyName: company.name,
      CountryCode: "SE",
      DatabaseNumber: Number(company.databaseNumber),
      OrganizationNumber: company.organizationNumber,
      VisitAddress: "Testgatan 1",
      VisitCity: "Göteborg",
      VisitCountryCode: "SE",
      VisitZipCode: "411 01",
      ZipCode: "411 01",
    },
  });
});

mockFortnox.get("/3/invoices", (c) => {
  const data = tenantFixtures(companyOf(c).databaseNumber);
  const filter = c.req.query("filter");
  const items =
    filter === "unpaid"
      ? data.invoices.filter((i) => i.Balance > 0)
      : filter === "fullypaid"
        ? data.invoices.filter((i) => i.Balance === 0)
        : data.invoices;
  return c.json(envelope("Invoices", items.map(({ InvoiceRows: _rows, ...summary }) => summary)));
});

mockFortnox.get("/3/invoices/:documentNumber", (c) => {
  const data = tenantFixtures(companyOf(c).databaseNumber);
  const invoice = data.invoices.find((i) => i.DocumentNumber === c.req.param("documentNumber"));
  if (!invoice) return c.json(errorInformation(2000434, "Invoice not found"), 404);
  return c.json({ Invoice: invoice });
});

mockFortnox.post("/3/invoices", async (c) => {
  const data = tenantFixtures(companyOf(c).databaseNumber);
  const body = await c.req.json<{ Invoice?: Record<string, unknown> }>();
  if (!body.Invoice) return c.json(errorInformation(2000600, "Missing Invoice root object"), 400);
  const invoice = {
    "@url": `mock://invoices/${data.invoices.length + 1}`,
    DocumentNumber: String(data.invoices.length + 1),
    CustomerNumber: "",
    CustomerName: "",
    InvoiceDate: new Date().toISOString().slice(0, 10),
    DueDate: new Date().toISOString().slice(0, 10),
    Total: 0,
    Balance: 0,
    Currency: "SEK",
    Cancelled: false,
    InvoiceRows: [],
    ...body.Invoice,
  } as (typeof data.invoices)[number];
  data.invoices.push(invoice);
  return c.json({ Invoice: invoice }, 201);
});

mockFortnox.get("/3/customers", (c) =>
  c.json(envelope("Customers", tenantFixtures(companyOf(c).databaseNumber).customers)),
);

mockFortnox.get("/3/customers/:customerNumber", (c) => {
  const data = tenantFixtures(companyOf(c).databaseNumber);
  const customer = data.customers.find((x) => x.CustomerNumber === c.req.param("customerNumber"));
  if (!customer) return c.json(errorInformation(2000434, "Customer not found"), 404);
  return c.json({ Customer: customer });
});

mockFortnox.get("/3/vouchers", (c) =>
  c.json(envelope("Vouchers", tenantFixtures(companyOf(c).databaseNumber).vouchers)),
);

mockFortnox.get("/3/accounts", (c) =>
  c.json(envelope("Accounts", tenantFixtures(companyOf(c).databaseNumber).accounts)),
);

mockFortnox.get("/3/sie/:type", (c) => {
  const company = companyOf(c);
  const sie = [
    "#FLAGGA 0",
    '#PROGRAM "accounting-mcp mock" 1.0',
    "#FORMAT PC8",
    `#FNAMN "${company.name}"`,
    `#ORGNR ${company.organizationNumber}`,
    "#RAR 0 20260101 20261231",
    '#KONTO 1930 "Företagskonto"',
    '#VER A 1 20260502 "Kundfaktura 1"',
  ].join("\n");
  return c.body(sie, 200, { "Content-Type": "application/octet-stream" });
});
