// Generates src/tools/fortnox/generated-ops.ts from specs/fortnox.json.
// Run via `npm run gen:fortnox`. The output is checked in; re-runs must be diff-clean.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const spec = JSON.parse(readFileSync(join(root, "specs", "fortnox.json"), "utf8"));

const METHODS = ["get", "post", "put", "delete", "patch"];
const EXCLUDED_TAG_PREFIXES = ["integration-developer", "integration-partner"];
const EXPECTED_COUNT = 372;

// The spec carries no scope metadata (its securitySchemes are an unmodified ory
// template), so the OAuth scope each endpoint needs is mapped by tag here. Tags
// are stable across spec revisions; paths are not. Every tag must be mapped —
// an unmapped one fails the build rather than silently emitting a tool nobody
// can call. Slugs come from fortnox.se/developer/guides-and-good-to-know/scopes
// — note "assets" is plural while most others are singular.
// UNVERIFIED: "warehouse" (Lager/Lagerdokument) isn't in that scope list; it's
// only a guess at the slug for the separate /api/warehouse/* module. Confirm
// with scripts/probe-fortnox-scopes.mjs before adding it to FORTNOX_SCOPES.
const TAG_SCOPES = {
  "fileattachments_Attachment": "connectfile",
  "fortnox_AbsenceTransactions": "salary",
  "fortnox_AccountCharts": "bookkeeping",
  "fortnox_Accounts": "bookkeeping",
  "fortnox_Archive": "archive",
  "fortnox_ArticleFileConnections": "connectfile",
  "fortnox_ArticleUrlConnection": "article",
  "fortnox_ArticleUrlConnections": "article",
  "fortnox_Articles": "article",
  "fortnox_AssetFileConnection": "assets",
  "fortnox_AssetTypes": "assets",
  "fortnox_Assets": "assets",
  "fortnox_AttendanceTransactions": "salary",
  "fortnox_CompanyInformation": "companyinformation",
  "fortnox_CompanySettings": "settings",
  "fortnox_ContractAccruals": "bookkeeping",
  "fortnox_ContractTemplates": "invoice",
  "fortnox_Contracts": "invoice",
  "fortnox_CostCenters": "costcenter",
  "fortnox_Currencies": "currency",
  "fortnox_CustomerReferences": "customer",
  "fortnox_Customers": "customer",
  "fortnox_EUVatLimitRegulation": "settings",
  "fortnox_Employees": "salary",
  "fortnox_Expenses": "salary",
  "fortnox_FinanceInvoices": "noxfinansinvoice",
  "fortnox_FinancialYears": "bookkeeping",
  "fortnox_Inbox": "inbox",
  "fortnox_InvoiceAccruals": "bookkeeping",
  "fortnox_InvoicePayments": "invoice",
  "fortnox_Invoices": "invoice",
  "fortnox_Labels": "settings",
  "fortnox_LockedPeriod": "settings",
  "fortnox_Me": "profile",
  "fortnox_ModesOfPayments": "payment",
  "fortnox_Offers": "offer",
  "fortnox_Orders": "order",
  "fortnox_PredefinedAccounts": "bookkeeping",
  "fortnox_PredefinedVoucherSeries": "bookkeeping",
  "fortnox_PriceLists": "price",
  "fortnox_Prices": "price",
  "fortnox_PrintTemplates": "print",
  "fortnox_Projects": "project",
  "fortnox_SalaryTransactions": "salary",
  "fortnox_ScheduleTimes": "salary",
  "fortnox_Sie": "bookkeeping",
  "fortnox_SupplierInvoiceAccruals": "bookkeeping",
  "fortnox_SupplierInvoiceExternalUrlConnections": "supplierinvoice",
  "fortnox_SupplierInvoiceFileConnections": "connectfile",
  "fortnox_SupplierInvoicePayments": "supplierinvoice",
  "fortnox_SupplierInvoices": "supplierinvoice",
  "fortnox_Suppliers": "supplier",
  "fortnox_TaxReductions": "invoice",
  "fortnox_TermsOfDeliveries": "settings",
  "fortnox_TermsOfPayments": "settings",
  "fortnox_TrustedEmailSenders": "settings",
  "fortnox_Units": "settings",
  "fortnox_VacationDebtBasis": "salary",
  "fortnox_VoucherFileConnections": "connectfile",
  "fortnox_VoucherSeries": "bookkeeping",
  "fortnox_Vouchers": "bookkeeping",
  "fortnox_WayOfDeliveries": "settings",
  "time-reporting_Articles": "timereporting",
  "time-reporting_Registrations": "timereporting",
  "warehouse_CustomDocumentType": "warehouse",
  "warehouse_CustomInboundDocument": "warehouse",
  "warehouse_CustomOutboundDocument": "warehouse",
  "warehouse_IncomingGoods": "warehouse",
  "warehouse_ManualDocument": "warehouse",
  "warehouse_ManualInboundDocument": "warehouse",
  "warehouse_ManualOutboundDocument": "warehouse",
  "warehouse_ProductionOrder": "warehouse",
  "warehouse_PurchaseOrder": "warehouse",
  "warehouse_StockPoint": "warehouse",
  "warehouse_StockStatus": "warehouse",
  "warehouse_StockTaking": "warehouse",
  "warehouse_StockTransfer": "warehouse",
  "warehouse_Tenant": "warehouse",
};

// operationId → tool name, for the handful of derived names that exceed 64 chars.
const NAME_OVERRIDES = {
  getNumberOfAttachmentsForEntity: "fortnox_fileattachments_attachment_count_for_entity",
  getStockLocationsByAmbiguousId: "fortnox_warehouse_stock_point_get_stock_locations_by_id",
};

function snake(s) {
  return s
    .replace(/[\s-]+/g, "_")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .toLowerCase();
}

function deriveVerb(operationId) {
  const controller = /^\w+Controller_do(\w+)$/.exec(operationId);
  const raw = controller ? controller[1] : operationId.replace(/_\d+$/, "");
  const verb = snake(raw);
  if (verb === "index") return "list";
  if (verb === "show") return "get";
  return verb;
}

function deriveName(op, path, method) {
  if (op.operationId && NAME_OVERRIDES[op.operationId]) return NAME_OVERRIDES[op.operationId];
  const tag = op.tags?.[0] ?? "fortnox_Unknown";
  const us = tag.indexOf("_");
  const group = us === -1 ? tag : tag.slice(0, us);
  const resource = snake(us === -1 ? "misc" : tag.slice(us + 1));
  const verb = op.operationId ? deriveVerb(op.operationId) : `${method}_${snake(path.replace(/[/{}]+/g, "_"))}`;
  return `fortnox_${group === "fortnox" ? "" : `${snake(group)}_`}${resource}_${verb}`;
}

function isBinary(op) {
  for (const [code, resp] of Object.entries(op.responses ?? {})) {
    if (!/^2\d\d$/.test(code)) continue;
    const types = Object.keys(resp.content ?? {});
    if (types.length > 0 && !types.some((t) => t.includes("json") || t === "*/*")) return true;
  }
  return false;
}

const QUERY_TYPES = new Set(["string", "integer", "number", "boolean", "array"]);

const ops = [];
for (const [path, item] of Object.entries(spec.paths)) {
  for (const method of METHODS) {
    const op = item[method];
    if (!op) continue;
    const tag = op.tags?.[0] ?? "";
    if (EXCLUDED_TAG_PREFIXES.some((p) => tag.startsWith(p))) continue;

    const query = (op.parameters ?? [])
      .filter((p) => p.in === "query")
      .map((p) => {
        const type = p.schema?.type;
        return { name: p.name, type: QUERY_TYPES.has(type) ? type : "string" };
      });

    const bodyContent = op.requestBody?.content ?? {};
    const upload = "multipart/form-data" in bodyContent;
    const body = !upload && Object.keys(bodyContent).length > 0;
    const summary = (op.summary ?? "").trim();
    const extra = (op.description ?? "").trim();
    let description = summary && extra && extra !== summary ? `${summary}. ${extra}` : summary || extra;
    description = description.replace(/\s+/g, " ").slice(0, 500);

    const def = {
      name: deriveName(op, path, method),
      title: summary || deriveName(op, path, method),
      description: description || summary || `${method.toUpperCase()} ${path}`,
      method,
      path,
      scope: TAG_SCOPES[tag] ?? `UNMAPPED:${tag}`,
      readOnly: method === "get",
    };
    if (method === "delete") def.destructive = true;
    if (method === "get" && query.some((q) => q.name === "sortby" || q.name === "lastmodified"))
      def.list = true;
    if (query.length > 0) def.query = query;
    if (body) def.body = true;
    if (upload) def.upload = true;
    if (isBinary(op)) def.binary = true;
    ops.push(def);
  }
}

// Sanity checks — fail loudly rather than emit a broken file.
const errors = [];
const seen = new Set();
for (const def of ops) {
  if (seen.has(def.name)) errors.push(`duplicate tool name: ${def.name}`);
  seen.add(def.name);
  if (def.name.length > 64) errors.push(`name >64 chars: ${def.name} (${def.name.length})`);
  if (!/^fortnox_[a-z0-9_]+$/.test(def.name)) errors.push(`invalid name: ${def.name}`);
}
const unmapped = [...new Set(ops.filter((o) => o.scope.startsWith("UNMAPPED:")).map((o) => o.scope.slice(9)))];
if (unmapped.length)
  errors.push(`tags missing from TAG_SCOPES: ${unmapped.join(", ")} — add them (scope slug from the apps.fortnox.se permission list)`);
if (ops.length !== EXPECTED_COUNT)
  errors.push(`expected ${EXPECTED_COUNT} ops, got ${ops.length} — update EXPECTED_COUNT if the spec changed intentionally`);
const uploads = ops.filter((o) => o.upload);
if (uploads.length !== 2)
  errors.push(`expected 2 upload ops, got ${uploads.length}: ${uploads.map((o) => o.path).join(", ")}`);
if (errors.length) {
  console.error("gen-fortnox-ops failed:\n" + errors.map((e) => `  - ${e}`).join("\n"));
  process.exit(1);
}

const lines = ops.map((def) => `  ${JSON.stringify(def)},`);
const out = `// AUTO-GENERATED by scripts/gen-fortnox-ops.mjs from specs/fortnox.json — do not edit.
// Regenerate with \`npm run gen:fortnox\`.
import type { FortnoxOpDef } from "./util.js";

export const fortnoxOpDefs: FortnoxOpDef[] = [
${lines.join("\n")}
];
`;
writeFileSync(join(root, "src", "tools", "fortnox", "generated-ops.ts"), out);
const byScope = [...new Set(ops.map((o) => o.scope))]
  .sort()
  .map((s) => `${s}=${ops.filter((o) => o.scope === s).length}`)
  .join(" ");
console.log(
  `gen-fortnox-ops: wrote ${ops.length} ops (${ops.filter((o) => o.readOnly).length} read-only, ${ops.filter((o) => o.binary).length} binary, ${uploads.length} upload)\n  scopes: ${byScope}`,
);
