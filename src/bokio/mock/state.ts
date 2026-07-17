import { randomUUID } from "node:crypto";

// In-memory state for the mock Bokio OAuth server + API. Reset on restart.

export const MOCK_CLIENT_ID = "mock-client-id";
export const MOCK_CLIENT_SECRET = "mock-client-secret";

export interface MockCompany {
  id: string;
  connectionId: string;
  name: string;
  organizationNumber: string;
  companyType: string;
  email: string;
}

export const companies: MockCompany[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    connectionId: randomUUID(),
    name: "Testbolaget AB",
    organizationNumber: "556677-8899",
    companyType: "limitedCompany",
    email: "ekonomi@testbolaget.se",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    connectionId: randomUUID(),
    name: "Demo Consulting HB",
    organizationNumber: "969696-1234",
    companyType: "partnership",
    email: "info@democonsulting.se",
  },
];

// --- Fixture accounting data, keyed by tenant ---

const paged = <T>(items: T[]) => ({
  totalItems: items.length,
  totalPages: 1,
  currentPage: 1,
  items,
});

export function fixtureData(tenantId: string) {
  const invoices = [
    {
      id: "aaaa0001-0000-4000-8000-000000000001",
      invoiceNumber: "1001",
      invoiceDate: "2026-05-02",
      dueDate: "2026-06-01",
      status: "paid",
      currency: "SEK",
      totalAmount: 12500,
      customerRef: { id: "cccc0001-0000-4000-8000-000000000001" },
      lineItems: [
        { type: "salesInvoiceItem", description: "Konsulttimmar maj", quantity: 10, unitPrice: 1000, vatRate: 25 },
      ],
    },
    {
      id: "aaaa0002-0000-4000-8000-000000000002",
      invoiceNumber: "1002",
      invoiceDate: "2026-06-05",
      dueDate: "2026-07-05",
      status: "sent",
      currency: "SEK",
      totalAmount: 8750,
      customerRef: { id: "cccc0002-0000-4000-8000-000000000002" },
      lineItems: [
        { type: "salesInvoiceItem", description: "Webbutveckling", quantity: 7, unitPrice: 1000, vatRate: 25 },
      ],
    },
  ];
  const customers = [
    { id: "cccc0001-0000-4000-8000-000000000001", name: "Kund AB", type: "company", organizationNumber: "556000-1111" },
    { id: "cccc0002-0000-4000-8000-000000000002", name: "Anna Andersson", type: "private" },
  ];
  const journalEntries = [
    {
      id: "eeee0001-0000-4000-8000-000000000001",
      journalEntryNumber: "V1",
      title: "Kundfaktura 1001",
      date: "2026-05-02",
      items: [
        { account: 1510, debit: 12500, credit: 0 },
        { account: 3001, debit: 0, credit: 10000 },
        { account: 2611, debit: 0, credit: 2500 },
      ],
    },
    {
      id: "eeee0002-0000-4000-8000-000000000002",
      journalEntryNumber: "V2",
      title: "Bankavgift",
      date: "2026-05-31",
      items: [
        { account: 6570, debit: 100, credit: 0 },
        { account: 1930, debit: 0, credit: 100 },
      ],
    },
  ];
  const accounts = [
    { account: 1510, name: "Kundfordringar", active: true },
    { account: 1930, name: "Företagskonto", active: true },
    { account: 2611, name: "Utgående moms 25%", active: true },
    { account: 3001, name: "Försäljning inom Sverige 25%", active: true },
    { account: 6570, name: "Bankkostnader", active: true },
  ];
  const fiscalYears = [
    { id: "ffff0001-0000-4000-8000-000000000001", startDate: "2025-01-01", endDate: "2025-12-31", status: "closed" },
    { id: "ffff0002-0000-4000-8000-000000000002", startDate: "2026-01-01", endDate: "2026-12-31", status: "open" },
  ];
  return { tenantId, invoices, customers, journalEntries, accounts, fiscalYears };
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

export { paged };

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
  process.env.BOKIO_MOCK_TOKEN_TTL ? Number(process.env.BOKIO_MOCK_TOKEN_TTL) : 3600;

export function issueTokens(tenantId: string) {
  const company = companies.find((c) => c.id === tenantId);
  if (!company) throw new Error(`unknown mock tenant ${tenantId}`);
  const ttl = mockAccessTokenTtl();
  const accessToken = `mock-at-${randomUUID()}`;
  const refreshToken = `mock-rt-${randomUUID()}`;
  accessTokens.set(accessToken, { tenantId, expiresAt: Date.now() + ttl * 1000 });
  refreshTokens.set(refreshToken, { tenantId });
  return {
    tenant_id: tenantId,
    tenant_type: "company" as const,
    access_token: accessToken,
    token_type: "bearer" as const,
    expires_in: ttl,
    refresh_token: refreshToken,
    connection_id: company.connectionId,
  };
}

export function resolveBearer(header: string | undefined): MockCompany | null {
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) return null;
  const entry = accessTokens.get(token);
  if (!entry || entry.expiresAt < Date.now()) return null;
  return companies.find((c) => c.id === entry.tenantId) ?? null;
}
