import { op, type BokioOpDef } from "./util.js";

const BODY_INVOICE =
  "Invoice fields (see Bokio API docs). Required: invoiceDate (YYYY-MM-DD), lineItems (array of {type:'salesInvoiceItem', description, quantity, unitPrice, vatRate,...}). Typical: customerRef {id}, dueDate, invoiceType ('invoice'|'cashInvoice').";

export const invoiceTools: BokioOpDef[] = [
  op("get", "/companies/{companyId}/invoices", {
    name: "bokio_list_invoices",
    title: "List invoices",
    description: "Lists customer invoices with paging and free-text filtering.",
    list: true,
    readOnly: true,
  }),
  op("get", "/companies/{companyId}/invoices/{invoiceId}", {
    name: "bokio_get_invoice",
    title: "Get invoice",
    description: "Fetches one invoice including line items, payments and status.",
    readOnly: true,
  }),
  op("post", "/companies/{companyId}/invoices", {
    name: "bokio_create_invoice",
    title: "Create invoice (draft)",
    description: "Creates a draft customer invoice. It is not visible to the customer until published.",
    body: BODY_INVOICE,
    readOnly: false,
  }),
  op("put", "/companies/{companyId}/invoices/{invoiceId}", {
    name: "bokio_update_invoice",
    title: "Update invoice",
    description: "Updates a draft invoice (same field shape as bokio_create_invoice).",
    body: BODY_INVOICE,
    readOnly: false,
  }),
  op("delete", "/companies/{companyId}/invoices/{invoiceId}", {
    name: "bokio_delete_invoice",
    title: "Delete invoice",
    description: "Permanently deletes a draft invoice.",
    readOnly: false,
    destructive: true,
  }),
  op("post", "/companies/{companyId}/invoices/{invoiceId}/publish", {
    name: "bokio_publish_invoice",
    title: "Publish invoice",
    description: "Publishes a draft invoice, making it final and sendable to the customer.",
    readOnly: false,
  }),
  op("post", "/companies/{companyId}/invoices/{invoiceId}/record", {
    name: "bokio_record_invoice",
    title: "Record invoice",
    description: "Records the published invoice in the journal (bookkeeping entry).",
    readOnly: false,
  }),
  op("post", "/companies/{companyId}/invoices/{invoiceId}/credit", {
    name: "bokio_credit_invoice",
    title: "Credit invoice",
    description: "Creates a credit note that reverses this invoice.",
    readOnly: false,
  }),
  op("get", "/companies/{companyId}/invoices/{invoiceId}/download", {
    name: "bokio_download_invoice",
    title: "Download invoice PDF",
    description: "Downloads the invoice as a PDF file.",
    binary: true,
    readOnly: true,
  }),
  op("post", "/companies/{companyId}/invoices/{invoiceId}/line-items", {
    name: "bokio_add_invoice_line_item",
    title: "Add invoice line item",
    description: "Adds a line item to a draft invoice.",
    body: "Line item, e.g. {type:'salesInvoiceItem', description, quantity, unitPrice, vatRate}.",
    readOnly: false,
  }),
  // Payments
  op("get", "/companies/{companyId}/invoices/{invoiceId}/payments", {
    name: "bokio_list_invoice_payments",
    title: "List invoice payments",
    description: "Lists payments registered on an invoice.",
    list: true,
    readOnly: true,
  }),
  op("get", "/companies/{companyId}/invoices/{invoiceId}/payments/{paymentId}", {
    name: "bokio_get_invoice_payment",
    title: "Get invoice payment",
    description: "Fetches one payment on an invoice.",
    readOnly: true,
  }),
  op("post", "/companies/{companyId}/invoices/{invoiceId}/payments", {
    name: "bokio_create_invoice_payment",
    title: "Create invoice payment",
    description: "Registers a payment on an invoice.",
    body: "Payment fields: paymentDate (YYYY-MM-DD), amount, and payment account details per Bokio docs.",
    readOnly: false,
  }),
  op("delete", "/companies/{companyId}/invoices/{invoiceId}/payments/{paymentId}", {
    name: "bokio_delete_invoice_payment",
    title: "Delete invoice payment",
    description: "Deletes a payment from an invoice.",
    readOnly: false,
    destructive: true,
  }),
  op("post", "/companies/{companyId}/invoices/{invoiceId}/payments/{paymentId}/record", {
    name: "bokio_record_invoice_payment",
    title: "Record invoice payment",
    description: "Records the payment in the journal.",
    readOnly: false,
  }),
  // Settlements
  op("get", "/companies/{companyId}/invoices/{invoiceId}/settlements", {
    name: "bokio_list_invoice_settlements",
    title: "List invoice settlements",
    description: "Lists settlements on an invoice.",
    list: true,
    readOnly: true,
  }),
  op("get", "/companies/{companyId}/invoices/{invoiceId}/settlements/{settlementId}", {
    name: "bokio_get_invoice_settlement",
    title: "Get invoice settlement",
    description: "Fetches one settlement on an invoice.",
    readOnly: true,
  }),
  op("post", "/companies/{companyId}/invoices/{invoiceId}/settlements", {
    name: "bokio_create_invoice_settlement",
    title: "Create invoice settlement",
    description: "Creates a settlement (e.g. write-off) on an invoice.",
    body: "Settlement fields per Bokio docs (settlementDate, type, amount...).",
    readOnly: false,
  }),
  op("delete", "/companies/{companyId}/invoices/{invoiceId}/settlements/{settlementId}", {
    name: "bokio_delete_invoice_settlement",
    title: "Delete invoice settlement",
    description: "Deletes a settlement from an invoice.",
    readOnly: false,
    destructive: true,
  }),
  op("post", "/companies/{companyId}/invoices/{invoiceId}/settlements/{settlementId}/record", {
    name: "bokio_record_invoice_settlement",
    title: "Record invoice settlement",
    description: "Records the settlement in the journal.",
    readOnly: false,
  }),
  // Attachments
  op("get", "/companies/{companyId}/invoices/{invoiceId}/attachments", {
    name: "bokio_list_invoice_attachments",
    title: "List invoice attachments",
    description: "Lists file attachments on an invoice.",
    list: true,
    readOnly: true,
  }),
  op("get", "/companies/{companyId}/invoices/{invoiceId}/attachments/{attachmentId}", {
    name: "bokio_get_invoice_attachment",
    title: "Get invoice attachment",
    description: "Fetches attachment metadata.",
    readOnly: true,
  }),
  op("post", "/companies/{companyId}/invoices/{invoiceId}/attachments", {
    name: "bokio_add_invoice_attachment",
    title: "Add invoice attachment",
    description: "Uploads a file attachment to an invoice.",
    upload: true,
    readOnly: false,
  }),
  op("delete", "/companies/{companyId}/invoices/{invoiceId}/attachments/{attachmentId}", {
    name: "bokio_delete_invoice_attachment",
    title: "Delete invoice attachment",
    description: "Removes an attachment from an invoice.",
    readOnly: false,
    destructive: true,
  }),
  op("get", "/companies/{companyId}/invoices/{invoiceId}/attachments/{attachmentId}/download", {
    name: "bokio_download_invoice_attachment",
    title: "Download invoice attachment",
    description: "Downloads an invoice attachment file.",
    binary: true,
    readOnly: true,
  }),
];
