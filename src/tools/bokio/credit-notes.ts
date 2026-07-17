import { op, type BokioOpDef } from "./util.js";

export const creditNoteTools: BokioOpDef[] = [
  op("get", "/companies/{companyId}/credit-notes", {
    name: "bokio_list_credit_notes",
    title: "List credit notes",
    description: "Lists credit notes with paging and free-text filtering.",
    list: true,
    readOnly: true,
  }),
  op("get", "/companies/{companyId}/credit-notes/{creditNoteId}", {
    name: "bokio_get_credit_note",
    title: "Get credit note",
    description: "Fetches one credit note.",
    readOnly: true,
  }),
  op("put", "/companies/{companyId}/credit-notes/{creditNoteId}", {
    name: "bokio_update_credit_note",
    title: "Update credit note",
    description: "Updates a draft credit note (created via bokio_credit_invoice).",
    body: "Credit note fields per Bokio docs (creditNoteDate, lineItems...).",
    readOnly: false,
  }),
  op("delete", "/companies/{companyId}/credit-notes/{creditNoteId}", {
    name: "bokio_delete_credit_note",
    title: "Delete credit note",
    description: "Permanently deletes a draft credit note.",
    readOnly: false,
    destructive: true,
  }),
  op("post", "/companies/{companyId}/credit-notes/{creditNoteId}/publish", {
    name: "bokio_publish_credit_note",
    title: "Publish credit note",
    description: "Publishes a draft credit note, making it final.",
    readOnly: false,
  }),
  op("post", "/companies/{companyId}/credit-notes/{creditNoteId}/record", {
    name: "bokio_record_credit_note",
    title: "Record credit note",
    description: "Records the credit note in the journal.",
    readOnly: false,
  }),
  op("get", "/companies/{companyId}/credit-notes/{creditNoteId}/download", {
    name: "bokio_download_credit_note",
    title: "Download credit note PDF",
    description: "Downloads the credit note as a PDF file.",
    binary: true,
    readOnly: true,
  }),
];
