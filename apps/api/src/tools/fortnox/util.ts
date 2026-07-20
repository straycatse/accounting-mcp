import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { paths } from "../../fortnox/generated/api.js";
import { createFortnoxClient, formatFortnoxError, type FortnoxErrorBody } from "../../fortnox/client.js";
import { config } from "../../config.js";
import { resolveConnection } from "../company-resolver.js";
import { errorResult, jsonResult, type ToolDef } from "../registry.js";

type HttpMethod = "get" | "post" | "put" | "delete" | "patch";

export interface FortnoxQueryParam {
  name: string;
  type: "string" | "integer" | "number" | "boolean" | "array";
}

export interface FortnoxOpDef {
  /** Tool name, e.g. "fortnox_invoices_list" */
  name: string;
  title: string;
  description: string;
  method: HttpMethod;
  // Unlike Bokio there is no {companyId} path segment: a Fortnox token is
  // scoped to one company, so the resolved connection alone picks the tenant.
  path: keyof paths & string;
  /** OAuth scope this endpoint needs; tools outside FORTNOX_SCOPES aren't registered */
  scope: string;
  /** Query params declared in the spec */
  query?: FortnoxQueryParam[];
  /** Collection endpoint → adds Fortnox's global page/limit/offset/sortorder params */
  list?: boolean;
  /** Accepts a JSON `body` argument */
  body?: boolean;
  /** Response is a binary download → returned as base64 resource */
  binary?: boolean;
  /** Multipart file upload (form field "file") */
  upload?: boolean;
  readOnly: boolean;
  destructive?: boolean;
}

const PATH_PARAM_RE = /\{([^}]+)\}/g;

function pathParamNames(path: string): string[] {
  return [...path.matchAll(PATH_PARAM_RE)].map((m) => m[1]!);
}

function queryZod(param: FortnoxQueryParam): z.ZodType {
  switch (param.type) {
    case "integer":
    case "number":
      return z.number().optional().describe(`Query parameter ${param.name}`);
    case "boolean":
      return z.boolean().optional().describe(`Query parameter ${param.name}`);
    case "array":
      return z.array(z.string()).optional().describe(`Query parameter ${param.name}`);
    default:
      return z.string().optional().describe(`Query parameter ${param.name}`);
  }
}

export function buildFortnoxTool(def: FortnoxOpDef): ToolDef {
  const input: Record<string, z.ZodType> = {
    companyId: z
      .string()
      .optional()
      .describe(
        "Fortnox company id (the DatabaseNumber from list_companies). Optional when exactly one Fortnox company is connected.",
      ),
  };
  for (const param of pathParamNames(def.path)) {
    input[param] = z.string().describe(`Path parameter ${param}`);
  }
  for (const param of def.query ?? []) {
    input[param.name] = queryZod(param);
  }
  if (def.list) {
    // Fortnox-wide pagination conventions (not declared per-op in the spec).
    input["page"] = z.number().int().min(1).optional().describe("Page number, starting at 1");
    input["limit"] = z.number().int().min(1).max(500).optional().describe("Items per page (max 500)");
    input["offset"] = z.number().int().min(0).optional().describe("Result offset");
    input["sortorder"] = z.enum(["ascending", "descending"]).optional().describe("Sort order");
  }
  if (def.body) {
    input["body"] = z
      .record(z.string(), z.unknown())
      .describe(
        'Request body. Fortnox wraps resources in a named root object, e.g. {"Invoice": {...}} — see the Fortnox API docs for the field shape.',
      );
  }
  if (def.upload) {
    input["fileName"] = z.string().describe("File name, e.g. receipt.pdf");
    input["fileBase64"] = z.string().describe("File content, base64-encoded");
    input["mimeType"] = z.string().optional().describe("MIME type (default application/pdf)");
  }

  const queryNames = [
    ...(def.query ?? []).map((q) => q.name),
    ...(def.list ? ["page", "limit", "offset", "sortorder"] : []),
  ];

  return {
    name: def.name,
    title: def.title,
    description: def.description,
    input,
    readOnly: def.readOnly,
    destructive: def.destructive,
    handler: async (args, ctx) => {
      const connection = await resolveConnection(
        ctx.userId,
        args["companyId"] as string | undefined,
        "fortnox",
      );
      const client = createFortnoxClient(connection);

      const pathParams: Record<string, unknown> = {};
      for (const param of pathParamNames(def.path)) pathParams[param] = args[param];

      const query: Record<string, unknown> = {};
      for (const k of queryNames) if (args[k] !== undefined) query[k] = args[k];

      const requestOptions: Record<string, unknown> = {
        params: {
          ...(Object.keys(pathParams).length ? { path: pathParams } : {}),
          ...(Object.keys(query).length ? { query } : {}),
        },
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
        requestOptions["body"] = form;
        requestOptions["bodySerializer"] = (b: FormData) => b;
      }
      if (def.binary) requestOptions["parseAs"] = "arrayBuffer";

      // Path validity vs. method is enforced at definition time by the generated
      // FortnoxOpDef literals; the dynamic dispatch itself can't stay statically typed.
      const caller = client[def.method.toUpperCase() as "GET"] as (
        p: string,
        o: unknown,
      ) => Promise<{ data?: unknown; error?: unknown; response: Response }>;
      const result = await caller(def.path, requestOptions);

      if (!result.response.ok) {
        return errorResult(
          formatFortnoxError(result.response.status, result.error as FortnoxErrorBody | undefined),
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
        const resolvedPath = def.path.replace(PATH_PARAM_RE, (_, name) => String(args[name] ?? ""));
        return {
          content: [
            {
              type: "resource",
              resource: {
                uri: `fortnox://${connection.tenantId}${resolvedPath}`,
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
