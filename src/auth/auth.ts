import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { jwt } from "better-auth/plugins";
import { oauthProvider } from "@better-auth/oauth-provider";
import { stripe } from "@better-auth/stripe";
import Stripe from "stripe";
import { config } from "../config.js";
import { db } from "../db/index.js";

// The Stripe client is only exercised when BILLING_ENABLED=true; the placeholder
// key keeps the plugin constructible (schema + routes) in dev/test without
// Stripe credentials.
const stripeClient = new Stripe(config.STRIPE_SECRET_KEY || "sk_test_placeholder");

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
    stripe({
      stripeClient,
      stripeWebhookSecret: config.STRIPE_WEBHOOK_SECRET || "whsec_placeholder",
      // Customers are created lazily at checkout, not on sign-up — sign-up must
      // never depend on Stripe being reachable (or configured, in dev/mock).
      createCustomerOnSignUp: false,
      subscription: {
        enabled: true,
        plans: [
          {
            name: "standard",
            priceId: config.STRIPE_PRICE_ID || undefined,
          },
        ],
        // Swedish moms / EU B2B reverse charge: let Stripe Tax compute VAT and
        // collect the buyer's VAT number. automatic_tax needs a customer
        // address, hence the required billing address + customer_update.
        getCheckoutSessionParams: () => ({
          params: {
            automatic_tax: { enabled: true },
            tax_id_collection: { enabled: true },
            billing_address_collection: "required",
            customer_update: { address: "auto", name: "auto" },
            locale: "sv",
          },
        }),
      },
    }),
  ],
});
