// Customers and suppliers.
import { op, type BokioOpDef } from "./util.js";

export const customerTools: BokioOpDef[] = [
  op("get", "/companies/{companyId}/customers", {
    name: "bokio_list_customers",
    title: "List customers",
    description: "Lists customers with paging and free-text filtering.",
    list: true,
    readOnly: true,
  }),
  op("get", "/companies/{companyId}/customers/{customerId}", {
    name: "bokio_get_customer",
    title: "Get customer",
    description: "Fetches one customer.",
    readOnly: true,
  }),
  op("post", "/companies/{companyId}/customers", {
    name: "bokio_create_customer",
    title: "Create customer",
    description: "Creates a customer.",
    body: "Customer fields. Required: name, type ('company'|'private'). Typical: organizationNumber, email, address {line1, city, postalCode, country}.",
    readOnly: false,
  }),
  op("put", "/companies/{companyId}/customers/{customerId}", {
    name: "bokio_update_customer",
    title: "Update customer",
    description: "Updates a customer (same field shape as bokio_create_customer).",
    body: "Customer fields, same shape as bokio_create_customer.",
    readOnly: false,
  }),
  op("delete", "/companies/{companyId}/customers/{customerId}", {
    name: "bokio_delete_customer",
    title: "Delete customer",
    description: "Permanently deletes a customer.",
    readOnly: false,
    destructive: true,
  }),
];

export const supplierTools: BokioOpDef[] = [
  op("get", "/companies/{companyId}/suppliers", {
    name: "bokio_list_suppliers",
    title: "List suppliers",
    description: "Lists suppliers with paging and free-text filtering.",
    list: true,
    readOnly: true,
  }),
  op("get", "/companies/{companyId}/suppliers/{supplierId}", {
    name: "bokio_get_supplier",
    title: "Get supplier",
    description: "Fetches one supplier.",
    readOnly: true,
  }),
  op("post", "/companies/{companyId}/suppliers", {
    name: "bokio_create_supplier",
    title: "Create supplier",
    description: "Creates a supplier.",
    body: "Supplier fields: name (required), organizationNumber, bankgiro/plusgiro details, email, address — per Bokio docs.",
    readOnly: false,
  }),
  op("put", "/companies/{companyId}/suppliers/{supplierId}", {
    name: "bokio_update_supplier",
    title: "Update supplier",
    description: "Updates a supplier (same field shape as bokio_create_supplier).",
    body: "Supplier fields, same shape as bokio_create_supplier.",
    readOnly: false,
  }),
  op("delete", "/companies/{companyId}/suppliers/{supplierId}", {
    name: "bokio_delete_supplier",
    title: "Delete supplier",
    description: "Permanently deletes a supplier.",
    readOnly: false,
    destructive: true,
  }),
];
