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
//
// apiVersion is pinned so that upgrading the stripe SDK can't silently move the
// API version underneath us (the SDK otherwise sends its own bundled default).
// Webhook payloads are rendered with the *account's* version instead, so the
// webhook endpoint in the Stripe dashboard must be pinned to this same version.
const stripeClient = new Stripe(config.STRIPE_SECRET_KEY || "sk_test_placeholder", {
  apiVersion: "2026-06-24.dahlia",
});

// The web app keeps the reader's language in a NEXT_LOCALE cookie (there is no
// locale in the URL), and its /api/auth/* rewrite forwards that cookie here — so
// Checkout can be rendered in the same language as the page that opened it.
// Swedish stays the default: this is a Swedish product with Swedish VAT.
const CHECKOUT_LOCALES = ["sv", "en"] as const;

function checkoutLocale(
  request: Request | undefined,
): Stripe.Checkout.SessionCreateParams.Locale {
  const cookie = request?.headers.get("cookie") ?? "";
  const value = cookie
    .split(";")
    .map((part) => part.trim().split("="))
    .find(([name]) => name === "NEXT_LOCALE")?.[1];
  return (CHECKOUT_LOCALES as readonly string[]).includes(value ?? "")
    ? (value as Stripe.Checkout.SessionCreateParams.Locale)
    : "sv";
}

export const auth = betterAuth({
  baseURL: config.BASE_URL,
  secret: config.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg" }),
  // The web app proxies /api/auth/* to us, so browser POSTs arrive with the web
  // origin in the Origin header; better-auth (and the Stripe plugin's
  // success/cancel/return URL originCheck) must trust it.
  trustedOrigins: [config.WEB_URL],
  emailAndPassword: {
    enabled: true,
  },
  // The oauth-provider plugin's /oauth2/token supersedes the legacy /token route.
  disabledPaths: ["/token"],
  plugins: [
    jwt(),
    oauthProvider({
      // Absolute web-origin URLs: sign-in/consent pages live on the Next.js app.
      // The plugin uses these verbatim (no origin validation) — pinned exactly in
      // package.json, with an e2e canary asserting the redirect target.
      loginPage: `${config.WEB_URL}/sign-in`,
      consentPage: `${config.WEB_URL}/consent`,
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
            // Stripe owns the trial: the subscription starts in `trialing` and
            // converts on day TRIAL_DAYS. No card is collected up front (see
            // payment_method_collection below). The plugin only grants this to
            // users who have never had a trial.
            freeTrial: { days: config.TRIAL_DAYS },
          },
        ],
        // Swedish moms / EU B2B reverse charge: let Stripe Tax compute VAT and
        // collect the buyer's VAT number. automatic_tax needs a customer
        // address, hence the required billing address + customer_update.
        getCheckoutSessionParams: (_data, request) => ({
          params: {
            automatic_tax: { enabled: true },
            tax_id_collection: { enabled: true },
            billing_address_collection: "required",
            customer_update: { address: "auto", name: "auto" },
            locale: checkoutLocale(request),
            // Start the trial without a card. `if_required` still collects one
            // on any checkout that isn't a trial (e.g. subscribing after a
            // lapsed trial, or adding a company), so only the trial is free of
            // that friction.
            payment_method_collection: "if_required",
            subscription_data: {
              // Without this, Stripe's default is `create_invoice`, which lands
              // a card-less trial in `past_due` — a status our entitlement
              // treats as a payment-retry grace period, i.e. it would keep
              // serving someone who never paid. `cancel` ends it cleanly, and
              // the plugin won't grant a second trial afterwards.
              trial_settings: { end_behavior: { missing_payment_method: "cancel" } },
            },
          },
        }),
      },
    }),
  ],
});
