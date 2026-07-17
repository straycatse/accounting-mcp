import type { ToolDef } from "../registry.js";
import { accountingTools } from "./accounting.js";
import { creditNoteTools } from "./credit-notes.js";
import { invoiceTools } from "./invoices.js";
import { journalEntryTools } from "./journal-entries.js";
import { bankPaymentTools, itemTools, tagTools, uploadTools } from "./misc.js";
import { customerTools, supplierTools } from "./parties.js";
import { supplierInvoiceTools } from "./supplier-invoices.js";
import { buildBokioTool, type BokioOpDef } from "./util.js";

export const bokioOpDefs: BokioOpDef[] = [
  ...accountingTools,
  ...journalEntryTools,
  ...invoiceTools,
  ...creditNoteTools,
  ...customerTools,
  ...supplierTools,
  ...supplierInvoiceTools,
  ...itemTools,
  ...tagTools,
  ...uploadTools,
  ...bankPaymentTools,
];

export const bokioTools: ToolDef[] = bokioOpDefs.map(buildBokioTool);
