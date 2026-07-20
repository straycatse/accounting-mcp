import { Hono, type Context } from "hono";
import { logger } from "hono/logger";
import { trpcServer } from "@hono/trpc-server";
import { sql } from "drizzle-orm";
import { auth } from "../auth/auth.js";
import { connectBokio } from "../auth/connect-bokio.js";
import { connectFortnox } from "../auth/connect-fortnox.js";
import { mockBokio } from "../bokio/mock/router.js";
import { mockFortnox } from "../fortnox/mock/router.js";
import { config } from "../config.js";
import { db } from "../db/index.js";
import { createContext } from "../trpc/context.js";
import { appRouter } from "../trpc/router.js";
import { mountMcp } from "./mcp.js";

export function createApp() {
  const app = new Hono();

  app.use("*", logger());

  app.get("/healthz", async (c) => {
    try {
      await db.execute(sql`select 1`);
      return c.json({ status: "ok", db: "ok" });
    } catch {
      return c.json({ status: "degraded", db: "unreachable" }, 503);
    }
  });

  // better-auth: sessions, email/password, and the OAuth 2.1 provider (oauth2/*).
  app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

  // AS metadata: the issuer is `${BASE_URL}/api/auth`, so RFC 8414 clients fetch the
  // path-suffix form; others fetch the root form. Both proxy to better-auth's handler.
  const proxyWellKnown = (target: string) => (c: Context) =>
    auth.handler(new Request(`${config.BASE_URL}/api/auth/${target}`, { headers: c.req.raw.headers }));
  for (const path of [
    "/.well-known/oauth-authorization-server",
    "/.well-known/oauth-authorization-server/api/auth",
  ]) {
    app.get(path, proxyWellKnown(".well-known/oauth-authorization-server"));
  }
  for (const path of [
    "/.well-known/openid-configuration",
    "/.well-known/openid-configuration/api/auth",
  ]) {
    app.get(path, proxyWellKnown(".well-known/openid-configuration"));
  }

  // Protected-resource metadata (RFC 9728) pointing MCP clients at our AS.
  const protectedResourceMetadata = {
    resource: `${config.BASE_URL}/mcp`,
    authorization_servers: [`${config.BASE_URL}/api/auth`],
    bearer_methods_supported: ["header"],
    scopes_supported: ["openid", "profile", "email", "offline_access", "accounting"],
  };
  for (const path of [
    "/.well-known/oauth-protected-resource",
    "/.well-known/oauth-protected-resource/mcp",
  ]) {
    app.get(path, (c) => c.json(protectedResourceMetadata));
  }

  if (config.BOKIO_MOCK) {
    app.route("/mock/bokio/v1", mockBokio);
  }
  if (config.FORTNOX_MOCK) {
    app.route("/mock/fortnox", mockFortnox);
  }

  // Dashboard data API for the Next.js web app (proxied through its origin).
  app.use(
    "/trpc/*",
    trpcServer({ router: appRouter, createContext: (_opts, c) => createContext(c.req.raw) }),
  );

  app.route("/", connectBokio);
  app.route("/", connectFortnox);
  mountMcp(app);

  return app;
}
