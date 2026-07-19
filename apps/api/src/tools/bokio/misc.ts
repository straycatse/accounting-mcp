// Items, tag groups, uploads, bank payments.
import { op, type BokioOpDef } from "./util.js";

export const itemTools: BokioOpDef[] = [
  op("get", "/companies/{companyId}/items", {
    name: "bokio_list_items",
    title: "List items",
    description: "Lists inventory/product items with paging and free-text filtering.",
    list: true,
    readOnly: true,
  }),
  op("get", "/companies/{companyId}/items/{itemId}", {
    name: "bokio_get_item",
    title: "Get item",
    description: "Fetches one item.",
    readOnly: true,
  }),
  op("post", "/companies/{companyId}/items", {
    name: "bokio_create_item",
    title: "Create item",
    description: "Creates a product/service item.",
    body: "Item fields per Bokio docs (name, unitPrice, vatRate, productType...).",
    readOnly: false,
  }),
  op("put", "/companies/{companyId}/items/{itemId}", {
    name: "bokio_update_item",
    title: "Update item",
    description: "Updates an item (same field shape as bokio_create_item).",
    body: "Item fields, same shape as bokio_create_item.",
    readOnly: false,
  }),
  op("delete", "/companies/{companyId}/items/{itemId}", {
    name: "bokio_delete_item",
    title: "Delete item",
    description: "Permanently deletes an item.",
    readOnly: false,
    destructive: true,
  }),
];

export const tagTools: BokioOpDef[] = [
  op("get", "/companies/{companyId}/tag-groups", {
    name: "bokio_list_tag_groups",
    title: "List tag groups",
    description: "Lists tag groups (cost centers, projects, etc.) with their tags.",
    list: true,
    readOnly: true,
  }),
  op("get", "/companies/{companyId}/tag-groups/{tagGroupId}", {
    name: "bokio_get_tag_group",
    title: "Get tag group",
    description: "Fetches one tag group.",
    readOnly: true,
  }),
  op("post", "/companies/{companyId}/tag-groups", {
    name: "bokio_create_tag_group",
    title: "Create tag group",
    description: "Creates a tag group.",
    body: "Tag group fields per Bokio docs (name, type...). Note: requires a Bokio price plan with the Tags feature.",
    readOnly: false,
  }),
  op("put", "/companies/{companyId}/tag-groups/{tagGroupId}", {
    name: "bokio_update_tag_group",
    title: "Update tag group",
    description: "Updates a tag group.",
    body: "Tag group fields, same shape as bokio_create_tag_group.",
    readOnly: false,
  }),
  op("delete", "/companies/{companyId}/tag-groups/{tagGroupId}", {
    name: "bokio_delete_tag_group",
    title: "Delete tag group",
    description: "Permanently deletes a tag group.",
    readOnly: false,
    destructive: true,
  }),
  op("post", "/companies/{companyId}/tag-groups/{tagGroupId}/tags", {
    name: "bokio_create_tag",
    title: "Create tag",
    description: "Adds a tag to a tag group.",
    body: "Tag fields: {name} per Bokio docs.",
    readOnly: false,
  }),
  op("put", "/companies/{companyId}/tag-groups/{tagGroupId}/tags/{tagId}", {
    name: "bokio_update_tag",
    title: "Update tag",
    description: "Updates a tag in a tag group.",
    body: "Tag fields: {name} per Bokio docs.",
    readOnly: false,
  }),
  op("delete", "/companies/{companyId}/tag-groups/{tagGroupId}/tags/{tagId}", {
    name: "bokio_delete_tag",
    title: "Delete tag",
    description: "Permanently deletes a tag from a tag group.",
    readOnly: false,
    destructive: true,
  }),
];

export const uploadTools: BokioOpDef[] = [
  op("get", "/companies/{companyId}/uploads", {
    name: "bokio_list_uploads",
    title: "List uploads",
    description: "Lists uploaded files (receipts, documents) with paging.",
    list: true,
    readOnly: true,
  }),
  op("get", "/companies/{companyId}/uploads/{uploadId}", {
    name: "bokio_get_upload",
    title: "Get upload",
    description: "Fetches metadata for one uploaded file.",
    readOnly: true,
  }),
  op("post", "/companies/{companyId}/uploads", {
    name: "bokio_add_upload",
    title: "Add upload",
    description: "Uploads a file (e.g. a receipt), optionally attached to a journal entry.",
    upload: true,
    readOnly: false,
  }),
  op("get", "/companies/{companyId}/uploads/{uploadId}/download", {
    name: "bokio_download_upload",
    title: "Download upload",
    description: "Downloads an uploaded file.",
    binary: true,
    readOnly: true,
  }),
];

export const bankPaymentTools: BokioOpDef[] = [
  op("get", "/companies/{companyId}/bank-payments", {
    name: "bokio_list_bank_payments",
    title: "List bank payments",
    description: "Lists bank payments created by this integration (limited read).",
    list: true,
    readOnly: true,
  }),
  op("get", "/companies/{companyId}/bank-payments/{bankPaymentId}", {
    name: "bokio_get_bank_payment",
    title: "Get bank payment",
    description: "Fetches one bank payment created by this integration.",
    readOnly: true,
  }),
  op("post", "/companies/{companyId}/bank-payments", {
    name: "bokio_create_bank_payment",
    title: "Create bank payment",
    description:
      "Creates a bank payment in the company's business bank account. Money movement — use with care.",
    body: "Bank payment fields per Bokio docs (recipient, amount, paymentDate, reference...).",
    readOnly: false,
    destructive: true,
  }),
  op("post", "/companies/{companyId}/bank-payments/bulk", {
    name: "bokio_create_bank_payments_bulk",
    title: "Create bank payments (bulk)",
    description: "Creates multiple bank payments at once. Money movement — use with care.",
    body: "Bulk payload: {payments: [...]} where each entry matches bokio_create_bank_payment.",
    readOnly: false,
    destructive: true,
  }),
];
