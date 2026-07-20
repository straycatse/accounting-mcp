import { eq, inArray, and } from "drizzle-orm";
import { config } from "../config.js";
import { db } from "../db/index.js";
import type { MessageKey } from "../lib/app-error.js";
import { billingAccount, subscription } from "../db/schema.js";

// Subscription statuses that grant access. `trialing` is the Stripe-run free
// trial (no card required). `past_due` is a grace period: Stripe is retrying a
// real card and will move the subscription on itself if recovery fails — a
// trial that lapses without a card never lands here, it goes straight to
// `canceled` (see trial_settings in auth.ts). Everything else — canceled,
// paused, unpaid, incomplete — is not covering.
const COVERING_STATUSES = ["active", "trialing", "past_due"];

export interface BillingState {
  billingEnabled: boolean;
  complimentary: boolean;
  subscriptionStatus: string | null;
  seats: number | null;
  trialEnd: Date | null;
  trialing: boolean;
}

/**
 * A refusal carries both forms of its explanation:
 *  - `message`: English prose, handed to the *model* through MCP tool results
 *    (company-resolver), where it doubles as an instruction to the assistant.
 *  - `key`/`params`: a message-catalog reference for the *browser*, translated
 *    in apps/web. Same refusal, two audiences, deliberately worded differently.
 */
export type Entitlement =
  | { ok: true }
  | ({ ok: false; reason: string; message: string } & MessageKey);

export async function getBillingState(userId: string): Promise<BillingState> {
  const [account] = await db
    .select()
    .from(billingAccount)
    .where(eq(billingAccount.userId, userId));
  const subs = await db
    .select({ status: subscription.status, seats: subscription.seats, trialEnd: subscription.trialEnd })
    .from(subscription)
    .where(and(eq(subscription.referenceId, userId), inArray(subscription.status, COVERING_STATUSES)));
  // A licensed subscription without an explicit seats value covers one company.
  const covering = subs.length > 0 ? subs.reduce((a, b) => ((a.seats ?? 1) >= (b.seats ?? 1) ? a : b)) : null;
  return {
    billingEnabled: config.BILLING_ENABLED,
    complimentary: account?.complimentary ?? false,
    subscriptionStatus: covering?.status ?? null,
    seats: covering ? (covering.seats ?? 1) : null,
    trialEnd: covering?.trialEnd ?? null,
    trialing: covering?.status === "trialing",
  };
}

/**
 * Whether the user may use `companyCount` connected companies right now.
 *
 * Called from two places:
 *  - the company-resolver choke point, with the user's current active count, so
 *    every provider tool is gated;
 *  - the Bokio connect flow, with count+1 when a *new* company is being added,
 *    so a connection that would exceed the paid seats is refused up front
 *    rather than silently breaking access to the companies already connected.
 */
export async function checkEntitlement(
  userId: string,
  companyCount: number,
): Promise<Entitlement> {
  if (!config.BILLING_ENABLED) return { ok: true };

  const state = await getBillingState(userId);
  if (state.complimentary) return { ok: true };

  if (state.subscriptionStatus === null) {
    return {
      ok: false,
      reason: "subscription_required",
      message:
        `This server requires a subscription (it starts with a ${config.TRIAL_DAYS}-day free trial). ` +
        `Ask the user to start it at ${config.BASE_URL}/dashboard.`,
      key: "billing.subscriptionRequired",
      params: { trialDays: config.TRIAL_DAYS },
    };
  }

  const seats = state.seats ?? 1;
  if (seats < companyCount) {
    return {
      ok: false,
      reason: "seats_exceeded",
      message:
        `The subscription covers ${seats} compan${seats === 1 ? "y" : "ies"} but ${companyCount} ` +
        `would be in use. Ask the user to add a company to their subscription at ` +
        `${config.BASE_URL}/dashboard (or disconnect one).`,
      key: "billing.seatsExceeded",
      params: { seats, required: companyCount },
    };
  }

  return { ok: true };
}
