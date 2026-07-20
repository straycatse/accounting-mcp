import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ZodRawShape } from "zod";
import { config } from "../config.js";

export interface ToolContext {
  userId: string;
}

export interface ToolDef<Shape extends ZodRawShape = ZodRawShape> {
  name: string;
  title: string;
  description: string;
  input: Shape;
  readOnly: boolean;
  destructive?: boolean;
  handler: (args: Record<string, unknown>, ctx: ToolContext) => Promise<CallToolResult>;
}

export const textResult = (text: string): CallToolResult => ({
  content: [{ type: "text", text }],
});

export const jsonResult = (value: unknown): CallToolResult => ({
  content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
});

export const errorResult = (text: string): CallToolResult => ({
  content: [{ type: "text", text }],
  isError: true,
});

const providerOf = (name: string) =>
  name.startsWith("bokio_") ? "bokio" : name.startsWith("fortnox_") ? "fortnox" : null;

async function audit(
  def: ToolDef,
  ctx: ToolContext,
  args: Record<string, unknown>,
  result: CallToolResult,
  durationMs: number,
) {
  try {
    const { db } = await import("../db/index.js");
    const { toolAuditLog } = await import("../db/schema.js");
    await db.insert(toolAuditLog).values({
      userId: ctx.userId,
      provider: providerOf(def.name),
      tenantId: typeof args["companyId"] === "string" ? args["companyId"] : null,
      toolName: def.name,
      mutating: !def.readOnly,
      success: !result.isError,
      durationMs,
      params: config.AUDIT_LOG_PARAMS ? JSON.stringify(args).slice(0, 2000) : null,
    });
  } catch (err) {
    console.error("[audit] failed to write audit log:", err);
  }
}

/**
 * Registers tool definitions on an MCP server. When writes are disabled,
 * mutating tools are omitted entirely (absent from tools/list, not just blocked).
 */
export function registerTools(server: McpServer, ctx: ToolContext, defs: ToolDef[]) {
  for (const def of defs) {
    const allowWrites =
      providerOf(def.name) === "fortnox" ? config.FORTNOX_ALLOW_WRITES : config.BOKIO_ALLOW_WRITES;
    if (!def.readOnly && !allowWrites) continue;
    server.registerTool(
      def.name,
      {
        title: def.title,
        description: def.description,
        inputSchema: def.input,
        annotations: {
          readOnlyHint: def.readOnly,
          destructiveHint: def.destructive ?? false,
          idempotentHint: def.readOnly,
        },
      },
      async (args: Record<string, unknown>) => {
        const started = Date.now();
        let result: CallToolResult;
        try {
          result = await def.handler(args ?? {}, ctx);
        } catch (err) {
          result = errorResult(err instanceof Error ? err.message : String(err));
        }
        void audit(def, ctx, args ?? {}, result, Date.now() - started);
        return result;
      },
    );
  }
}
