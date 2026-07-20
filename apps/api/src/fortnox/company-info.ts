import { fortnoxSettings } from "./settings.js";

interface CompanyInformationResponse {
  CompanyInformation?: {
    CompanyName?: string;
    DatabaseNumber?: number | string;
    OrganizationNumber?: string;
  };
}

/**
 * Resolves the company identity behind an access token. Unlike Bokio, the
 * token itself carries no tenant id, so this call is mandatory — without a
 * DatabaseNumber there is nothing to store the connection under.
 */
export async function fetchFortnoxCompanyInfo(
  accessToken: string,
): Promise<{ tenantId: string; companyName: string | null }> {
  const res = await fetch(`${fortnoxSettings.apiBaseUrl}/3/companyinformation`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Could not read company information from Fortnox (HTTP ${res.status}).`);
  }
  const data = (await res.json()) as CompanyInformationResponse;
  const info = data.CompanyInformation;
  if (info?.DatabaseNumber === undefined || info.DatabaseNumber === null) {
    throw new Error("Fortnox company information response is missing DatabaseNumber.");
  }
  return { tenantId: String(info.DatabaseNumber), companyName: info.CompanyName ?? null };
}
