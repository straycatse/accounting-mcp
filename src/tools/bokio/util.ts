import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { paths } from "../../bokio/generated/company.js";
import { createBokioClient } from "../../bokio/client.js";
import { config } from "../../config.js";
import { resolveConnection } from "../company-resolver.js";
import { errorResult, jsonResult, type ToolDef } from "../registry.js";

type HttpMethod = "get" | "post" | "put" | "delete";
type PathsWithMethod<M extends HttpMethod> = {
  [P in keyof paths]: paths[P] extends Record<M, unknown> ? P : never;
}[keyof paths];

export interface BokioOpDef {
  /** Tool name, e.g. "bokio_list_invoices" */
  name: string;
  title: string;
  description: string;
  method: HttpMethod;
  path: keyof paths & string;
  /** Adds page/pageSize/query inputs (list endpoints) */
  list?: boolean;
  /** Additional query-string params exposed as string inputs */
  extraQuery?: string[];
  /** Accepts a JSON `body` argument; the string documents its shape */
  body?: string;
  /** Response is a binary download → returned as base64 resource */
  binary?: boolean;
  /** Multipart file upload: takes fileName/fileBase64/mimeType (+extra fields) */
  upload?: boolean;
  readOnly: boolean;
  destructive?: boolean;
}

/** Compile-time check that `path` actually supports `method` in the generated spec types. */
export function op<M extends HttpMethod, P extends PathsWithMethod<M> & string>(
  method: M,
  path: P,
  def: Omit<BokioOpDef, "method" | "path">,
): BokioOpDef {
  return { ...def, method, path };
}

const PATH_PARAM_RE = /\{(\w+)\}/g;

function pathParamNames(path: string): string[] {
  return [...path.matchAll(PATH_PARAM_RE)].map((m) => m[1]!).filter((p) => p !== "companyId");
}

export function buildBokioTool(def: BokioOpDef): ToolDef {
  const input: Record<string, z.ZodType> = {
    companyId: z
      .string()
      .optional()
      .describe("Bokio company id (from list_companies). Optional when exactly one company is connected."),
  };
  for (const param of pathParamNames(def.path)) {
    input[param] = z.string().describe(`Path parameter ${param}`);
  }
  if (def.list) {
    input["page"] = z.number().int().min(1).optional().describe("Page number, starting at 1");
    input["pageSize"] = z.number().int().min(1).max(100).optional().describe("Items per page (max 100)");
    input["query"] = z.string().optional().describe("Free-text filter");
  }
  for (const param of def.extraQuery ?? []) {
    input[param] = z.string().optional().describe(`Query parameter ${param}`);
  }
  if (def.body) {
    input["body"] = z.record(z.string(), z.unknown()).describe(def.body);
  }
  if (def.upload) {
    input["fileName"] = z.string().describe("File name, e.g. receipt.pdf");
    input["fileBase64"] = z.string().describe("File content, base64-encoded");
    input["mimeType"] = z.string().optional().describe("MIME type (default application/pdf)");
    input["description"] = z.string().optional().describe("Description of the upload");
    input["journalEntryId"] = z.string().optional().describe("Journal entry to attach the upload to");
  }

  return {
    name: def.name,
    title: def.title,
    description: def.description,
    input,
    readOnly: def.readOnly,
    destructive: def.destructive,
    handler: async (args, ctx) => {
      const connection = await resolveConnection(ctx.userId, args["companyId"] as string | undefined);
      const client = createBokioClient(connection);

      const pathParams: Record<string, unknown> = { companyId: connection.tenantId };
      for (const param of pathParamNames(def.path)) pathParams[param] = args[param];

      const query: Record<string, unknown> = {};
      if (def.list) {
        for (const k of ["page", "pageSize", "query"]) if (args[k] !== undefined) query[k] = args[k];
      }
      for (const k of def.extraQuery ?? []) if (args[k] !== undefined) query[k] = args[k];

      const requestOptions: Record<string, unknown> = {
        params: { path: pathParams, ...(Object.keys(query).length ? { query } : {}) },
      };
      if (def.body) requestOptions["body"] = args["body"];
      if (def.upload) {
        const bytes = Buffer.from(String(args["fileBase64"]), "base64");
        if (bytes.length > config.BINARY_MAX_BYTES) {
          return errorResult(`Upload exceeds the ${config.BINARY_MAX_BYTES} byte limit.`);
        }
        const form = new FormData();
        form.set(
          "file",
          new Blob([bytes], { type: String(args["mimeType"] ?? "application/pdf") }),
          String(args["fileName"]),
        );
        if (args["description"]) form.set("description", String(args["description"]));
        if (args["journalEntryId"]) form.set("journalEntryId", String(args["journalEntryId"]));
        requestOptions["body"] = form;
        requestOptions["bodySerializer"] = (b: FormData) => b;
      }
      if (def.binary) requestOptions["parseAs"] = "arrayBuffer";

      // Path validity vs. method is enforced at definition time by `op()`;
      // the dynamic dispatch itself can't stay statically typed.
      const caller = client[def.method.toUpperCase() as "GET"] as (
        p: string,
        o: unknown,
      ) => Promise<{ data?: unknown; error?: unknown; response: Response }>;
      const result = await caller(def.path, requestOptions);

      if (!result.response.ok) {
        const { formatBokioError } = await import("../../bokio/client.js");
        return errorResult(
          formatBokioError(result.response.status, result.error as never),
        );
      }

      if (def.binary) {
        const buf = Buffer.from(result.data as ArrayBuffer);
        if (buf.length > config.BINARY_MAX_BYTES) {
          return errorResult(
            `The file is ${buf.length} bytes, above the ${config.BINARY_MAX_BYTES} byte limit for inline downloads.`,
          );
        }
        const mimeType = result.response.headers.get("content-type") ?? "application/octet-stream";
        return {
          content: [
            {
              type: "resource",
              resource: {
                uri: `bokio://${connection.tenantId}${def.path.replace("/companies/{companyId}", "")}`,
                mimeType,
                blob: buf.toString("base64"),
              },
            },
          ],
        } satisfies CallToolResult;
      }

      if (result.data === undefined || result.response.status === 204) {
        return jsonResult({ ok: true, status: result.response.status });
      }
      return jsonResult(result.data);
    },
  };
}
