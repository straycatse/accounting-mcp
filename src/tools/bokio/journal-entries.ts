import { op, type BokioOpDef } from "./util.js";

export const journalEntryTools: BokioOpDef[] = [
  op("get", "/companies/{companyId}/journal-entries", {
    name: "bokio_list_journal_entries",
    title: "List journal entries",
    description: "Lists journal entries (verifikationer) with paging, free-text filter and optional tagId.",
    list: true,
    extraQuery: ["tagId"],
    readOnly: true,
  }),
  op("get", "/companies/{companyId}/journal-entries/{journalEntryId}", {
    name: "bokio_get_journal_entry",
    title: "Get journal entry",
    description: "Fetches one journal entry with its debit/credit items.",
    readOnly: true,
  }),
  op("post", "/companies/{companyId}/journal-entries", {
    name: "bokio_create_journal_entry",
    title: "Create journal entry",
    description:
      "Creates a journal entry (verifikation). This posts directly to the books — double-check accounts and amounts.",
    body: "Journal entry: {title, date (YYYY-MM-DD), items: [{account (e.g. 1930), debit, credit}, ...]} — debits must equal credits.",
    readOnly: false,
  }),
  op("post", "/companies/{companyId}/journal-entries/{journalEntryId}/reverse", {
    name: "bokio_reverse_journal_entry",
    title: "Reverse journal entry",
    description: "Creates a reversing entry that cancels out the given journal entry.",
    readOnly: false,
  }),
  op("put", "/companies/{companyId}/journal-entries/{journalEntryId}/tags", {
    name: "bokio_set_journal_entry_tags",
    title: "Set journal entry tags",
    description: "Replaces the tags on a journal entry.",
    body: "Tags payload: {tags: [{id}...]} per Bokio docs.",
    readOnly: false,
  }),
  op("get", "/companies/{companyId}/journal-entries/{journalEntryId}/comments", {
    name: "bokio_list_journal_entry_comments",
    title: "List journal entry comments",
    description: "Lists comments on a journal entry.",
    readOnly: true,
  }),
  op("get", "/companies/{companyId}/journal-entries/{journalEntryId}/comments/{commentId}", {
    name: "bokio_get_journal_entry_comment",
    title: "Get journal entry comment",
    description: "Fetches one comment on a journal entry.",
    readOnly: true,
  }),
  op("post", "/companies/{companyId}/journal-entries/{journalEntryId}/comments", {
    name: "bokio_add_journal_entry_comment",
    title: "Add journal entry comment",
    description: "Adds a comment to a journal entry.",
    body: "Comment: {comment: string}.",
    readOnly: false,
  }),
  op("put", "/companies/{companyId}/journal-entries/{journalEntryId}/comments/{commentId}", {
    name: "bokio_update_journal_entry_comment",
    title: "Update journal entry comment",
    description: "Edits a comment on a journal entry.",
    body: "Comment: {comment: string}.",
    readOnly: false,
  }),
  op("delete", "/companies/{companyId}/journal-entries/{journalEntryId}/comments/{commentId}", {
    name: "bokio_delete_journal_entry_comment",
    title: "Delete journal entry comment",
    description: "Deletes a comment from a journal entry.",
    readOnly: false,
    destructive: true,
  }),
];
