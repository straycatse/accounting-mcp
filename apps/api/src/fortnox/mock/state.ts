import { randomUUID } from "node:crypto";

export const MOCK_CLIENT_ID = "mock-fortnox-client";
export const MOCK_CLIENT_SECRET = "mock-fortnox-secret";

export interface MockFortnoxCompany {
  /** Fortnox DatabaseNumber — the tenant id we store connections under. */
  databaseNumber: string;
  name: string;
  organizationNumber: string;
}

export const companies: MockFortnoxCompany[] = [
  { databaseNumber: "1001", name: "Fortnox Testbolag AB", organizationNumber: "556000-1001" },
  { databaseNumber: "1002", name: "Fjällbacka Konsult AB", organizationNumber: "556000-1002" },
];

// Fortnox list envelope: named collection + MetaInformation.
export function envelope<T>(key: string, items: T[]) {
  return {
    [key]: items,
    MetaInformation: {
      "@TotalResources": items.length,
      "@TotalPages": 1,
      "@CurrentPage": 1,
    },
  };
}

function fixtureData(tenantId: string) {
  const invoices = [
    {
      "@url": `mock://invoices/1`,
      DocumentNumber: "1",
      CustomerNumber: "1",
      CustomerName: "Acme AB",
      InvoiceDate: "2026-05-02",
      DueDate: "2026-06-01",
      Total: 12500,
      Balance: 12500,
      Currency: "SEK",
      Cancelled: false,
      InvoiceRows: [
        { ArticleNumber: "K1", Description: "Konsulttimmar", DeliveredQuantity: "10", Price: 1000, VAT: 25 },
      ],
    },
    {
      "@url": `mock://invoices/2`,
      DocumentNumber: "2",
      CustomerNumber: "2",
      CustomerName: "Nordic Design HB",
      InvoiceDate: "2026-06-10",
      DueDate: "2026-07-10",
      Total: 4200,
      Balance: 0,
      Currency: "SEK",
      Cancelled: false,
      InvoiceRows: [{ ArticleNumber: "T1", Description: "Formgivning", DeliveredQuantity: "6", Price: 560, VAT: 25 }],
    },
  ];
  const customers = [
    { CustomerNumber: "1", Name: "Acme AB", OrganisationNumber: "556123-4567", Email: "faktura@acme.se", City: "Göteborg" },
    { CustomerNumber: "2", Name: "Nordic Design HB", OrganisationNumber: "969600-1234", Email: "eko@nordicdesign.se", City: "Stockholm" },
  ];
  const vouchers = [
    { VoucherSeries: "A", VoucherNumber: 1, TransactionDate: "2026-05-02", Description: "Kundfaktura 1", Year: 1 },
    { VoucherSeries: "A", VoucherNumber: 2, TransactionDate: "2026-06-10", Description: "Kundfaktura 2", Year: 1 },
  ];
  const accounts = [
    { Number: 1510, Description: "Kundfordringar", Active: true },
    { Number: 1930, Description: "Företagskonto", Active: true },
    { Number: 2611, Description: "Utgående moms 25%", Active: true },
    { Number: 3001, Description: "Försäljning inom Sverige 25%", Active: true },
  ];
  return { tenantId, invoices, customers, vouchers, accounts };
}

const fixtureCache = new Map<string, ReturnType<typeof fixtureData>>();
export function tenantFixtures(tenantId: string) {
  let data = fixtureCache.get(tenantId);
  if (!data) {
    data = fixtureData(tenantId);
    fixtureCache.set(tenantId, data);
  }
  return data;
}

interface AuthCode {
  tenantId: string;
  redirectUri: string;
  expiresAt: number;
}

export const authCodes = new Map<string, AuthCode>();
export const accessTokens = new Map<string, { tenantId: string; expiresAt: number }>();
export const refreshTokens = new Map<string, { tenantId: string }>();

// Short expiry (seconds) can be forced via env to exercise refresh logic in tests.
export const mockAccessTokenTtl = () =>
  process.env.FORTNOX_MOCK_TOKEN_TTL ? Number(process.env.FORTNOX_MOCK_TOKEN_TTL) : 3600;

export function issueTokens(tenantId: string) {
  const company = companies.find((c) => c.databaseNumber === tenantId);
  if (!company) throw new Error(`unknown mock tenant ${tenantId}`);
  const ttl = mockAccessTokenTtl();
  const accessToken = `mock-fnx-at-${randomUUID()}`;
  const refreshToken = `mock-fnx-rt-${randomUUID()}`;
  accessTokens.set(accessToken, { tenantId, expiresAt: Date.now() + ttl * 1000 });
  refreshTokens.set(refreshToken, { tenantId });
  // Fortnox token responses carry no tenant id — identity comes from
  // /3/companyinformation, exactly like the real API.
  return {
    access_token: accessToken,
    token_type: "bearer" as const,
    expires_in: ttl,
    refresh_token: refreshToken,
    scope: "companyinformation bookkeeping invoice customer",
  };
}

export function resolveBearer(header: string | undefined): MockFortnoxCompany | null {
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) return null;
  const entry = accessTokens.get(token);
  if (entry && entry.expiresAt >= Date.now()) {
    return companies.find((c) => c.databaseNumber === entry.tenantId) ?? null;
  }
  return null;
}
