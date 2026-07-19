import { randomUUID } from "node:crypto";
import type { Context, Hono } from "hono";
import { StreamableHTTPTransport } from "@hono/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { verifyAccessToken } from "better-auth/oauth2";
import { config } from "../config.js";
import { bokioTools } from "../tools/bokio/index.js";
import { metaTools } from "../tools/meta.js";
import { registerTools } from "../tools/registry.js";

const SESSION_IDLE_MS = 30 * 60 * 1000;

export interface McpRequestContext {
  userId: string;
}

interface McpSession {
  transport: StreamableHTTPTransport;
  server: McpServer;
  context: McpRequestContext;
  lastSeen: number;
}

const sessions = new Map<string, McpSession>();

setInterval(() => {
  const cutoff = Date.now() - SESSION_IDLE_MS;
  for (const [id, session] of sessions) {
    if (session.lastSeen < cutoff) {
      sessions.delete(id);
      void session.transport.close();
    }
  }
}, 60_000).unref();

function unauthorized(c: Context) {
  return c.json(
    { error: "unauthorized", error_description: "Missing or invalid access token" },
    401,
    {
      "WWW-Authenticate": `Bearer resource_metadata="${config.BASE_URL}/.well-known/oauth-protected-resource"`,
    },
  );
}

async function authenticate(c: Context): Promise<{ userId: string } | null> {
  const header = c.req.header("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  try {
    const payload = await verifyAccessToken(header.slice("Bearer ".length), {
      verifyOptions: {
        issuer: `${config.BASE_URL}/api/auth`,
        audience: [`${config.BASE_URL}/mcp`, config.BASE_URL],
      },
      jwksUrl: `${config.BASE_URL}/api/auth/jwks`,
    });
    if (!payload.sub) return null;
    return { userId: payload.sub };
  } catch {
    return null;
  }
}

function buildMcpServer(context: McpRequestContext): McpServer {
  const server = new McpServer({ name: "accounting-mcp", version: "0.1.0" });
  server.registerTool(
    "ping",
    {
      description: "Health check: verifies the MCP connection and authentication are working.",
      annotations: { readOnlyHint: true },
    },
    async () => ({
      content: [{ type: "text", text: `pong — authenticated as user ${context.userId}` }],
    }),
  );
  registerTools(server, context, [...metaTools, ...bokioTools]);
  return server;
}

export function mountMcp(app: Hono) {
  app.all("/mcp", async (c) => {
    const authed = await authenticate(c);
    if (!authed) return unauthorized(c);

    const sessionId = c.req.header("mcp-session-id");
    if (sessionId) {
      const session = sessions.get(sessionId);
      if (!session) {
        return c.json(
          { jsonrpc: "2.0", error: { code: -32001, message: "Session not found" }, id: null },
          404,
        );
      }
      if (session.context.userId !== authed.userId) {
        return c.json({ error: "forbidden", error_description: "Session belongs to another user" }, 403);
      }
      session.lastSeen = Date.now();
      return session.transport.handleRequest(c);
    }

    // No session header: a new initialize request.
    const context: McpRequestContext = { userId: authed.userId };
    const server = buildMcpServer(context);
    const transport = new StreamableHTTPTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (id) => {
        sessions.set(id, { transport, server, context, lastSeen: Date.now() });
      },
      onsessionclosed: (id) => {
        sessions.delete(id);
      },
    });
    await server.connect(transport);
    return transport.handleRequest(c);
  });
}
