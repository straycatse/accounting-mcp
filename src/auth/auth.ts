import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { jwt } from "better-auth/plugins";
import { oauthProvider } from "@better-auth/oauth-provider";
import { config } from "../config.js";
import { db } from "../db/index.js";

export const auth = betterAuth({
  baseURL: config.BASE_URL,
  secret: config.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: {
    enabled: true,
  },
  // The oauth-provider plugin's /oauth2/token supersedes the legacy /token route.
  disabledPaths: ["/token"],
  plugins: [
    jwt(),
    oauthProvider({
      loginPage: "/sign-in",
      consentPage: "/consent",
      allowDynamicClientRegistration: true,
      // MCP clients (Claude, ChatGPT) register as public clients without credentials
      allowUnauthenticatedClientRegistration: true,
      // offline_access enables refresh tokens — MCP clients need long-lived access
      scopes: ["openid", "profile", "email", "offline_access", "accounting"],
      // MCP clients request resource=<mcp endpoint> (RFC 8707); tokens minted
      // without an explicit resource default to this same audience list.
      validAudiences: [`${config.BASE_URL}/mcp`, config.BASE_URL],
    }),
  ],
});
