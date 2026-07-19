import { op, type BokioOpDef } from "./util.js";

const BODY_SUPPLIER_INVOICE =
  "Supplier invoice fields. Required: invoiceDate, dueDate, totalAmount, supplierRef {id}. Optional: invoiceNumber, uploadRef {id}.";

export const supplierInvoiceTools: BokioOpDef[] = [
  op("get", "/companies/{companyId}/supplier-invoices", {
    name: "bokio_list_supplier_invoices",
    title: "List supplier invoices",
    description: "Lists supplier invoices with paging and free-text filtering.",
    list: true,
    readOnly: true,
  }),
  op("get", "/companies/{companyId}/supplier-invoices/{supplierInvoiceId}", {
    name: "bokio_get_supplier_invoice",
    title: "Get supplier invoice",
    description: "Fetches one supplier invoice.",
    readOnly: true,
  }),
  op("post", "/companies/{companyId}/supplier-invoices", {
    name: "bokio_create_supplier_invoice",
    title: "Create supplier invoice",
    description: "Registers a received supplier invoice.",
    body: BODY_SUPPLIER_INVOICE,
    readOnly: false,
  }),
  op("put", "/companies/{companyId}/supplier-invoices/{supplierInvoiceId}", {
    name: "bokio_update_supplier_invoice",
    title: "Update supplier invoice",
    description: "Updates a supplier invoice (same field shape as bokio_create_supplier_invoice).",
    body: BODY_SUPPLIER_INVOICE,
    readOnly: false,
  }),
  op("delete", "/companies/{companyId}/supplier-invoices/{supplierInvoiceId}", {
    name: "bokio_delete_supplier_invoice",
    title: "Delete supplier invoice",
    description: "Permanently deletes a supplier invoice.",
    readOnly: false,
    destructive: true,
  }),
  op("post", "/companies/{companyId}/supplier-invoices/{supplierInvoiceId}/uploads", {
    name: "bokio_attach_supplier_invoice_upload",
    title: "Attach upload to supplier invoice",
    description: "Links an existing upload (see bokio_add_upload) to a supplier invoice.",
    body: "Upload reference: {uploadRef: {id: '<uploadId>'}} per Bokio docs.",
    readOnly: false,
  }),
];
