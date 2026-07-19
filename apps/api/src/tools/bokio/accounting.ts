// Chart of accounts, fiscal years, company info, SIE export.
import { op, type BokioOpDef } from "./util.js";

export const accountingTools: BokioOpDef[] = [
  op("get", "/companies/{companyId}/company-information", {
    name: "bokio_get_company_information",
    title: "Get company information",
    description: "Fetches the company's registered information (name, org number, type, address).",
    readOnly: true,
  }),
  op("get", "/companies/{companyId}/chart-of-accounts", {
    name: "bokio_list_accounts",
    title: "List chart of accounts",
    description: "Lists the chart of accounts (kontoplan), optionally filtered by free text.",
    extraQuery: ["query"],
    readOnly: true,
  }),
  op("get", "/companies/{companyId}/chart-of-accounts/{account}", {
    name: "bokio_get_account",
    title: "Get account",
    description: "Fetches one account by its number (e.g. 1930).",
    readOnly: true,
  }),
  op("get", "/companies/{companyId}/fiscal-years", {
    name: "bokio_list_fiscal_years",
    title: "List fiscal years",
    description: "Lists the company's fiscal years.",
    list: true,
    readOnly: true,
  }),
  op("get", "/companies/{companyId}/fiscal-years/{fiscalYearId}", {
    name: "bokio_get_fiscal_year",
    title: "Get fiscal year",
    description: "Fetches one fiscal year.",
    readOnly: true,
  }),
  op("get", "/companies/{companyId}/sie/{fiscalYearId}/download", {
    name: "bokio_download_sie",
    title: "Download SIE file",
    description:
      "Downloads the SIE export (Swedish standard accounting interchange format) for a fiscal year.",
    binary: true,
    readOnly: true,
  }),
];
