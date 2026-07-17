import { eq, inArray, and } from "drizzle-orm";
import { config } from "../config.js";
import { db } from "../db/index.js";
import { billingAccount, subscription } from "../db/schema.js";

// Subscription statuses that grant access. past_due is a grace period: Stripe
// is retrying payment and will move the subscription to canceled/unpaid itself.
const COVERING_STATUSES = ["active", "trialing", "past_due"];

export interface BillingState {
  billingEnabled: boolean;
  complimentary: boolean;
  trialEndsAt: Date | null;
  trialActive: boolean;
  subscriptionStatus: string | null;
  seats: number | null;
}

export type Entitlement = { ok: true } | { ok: false; reason: string; message: string };

export async function getBillingState(userId: string): Promise<BillingState> {
  const [account] = await db
    .select()
    .from(billingAccount)
    .where(eq(billingAccount.userId, userId));
  const subs = await db
    .select({ status: subscription.status, seats: subscription.seats })
    .from(subscription)
    .where(and(eq(subscription.referenceId, userId), inArray(subscription.status, COVERING_STATUSES)));
  // A licensed subscription without an explicit seats value covers one company.
  const covering = subs.length > 0 ? subs.reduce((a, b) => ((a.seats ?? 1) >= (b.seats ?? 1) ? a : b)) : null;
  const trialEndsAt = account?.trialEndsAt ?? null;
  return {
    billingEnabled: config.BILLING_ENABLED,
    complimentary: account?.complimentary ?? false,
    trialEndsAt,
    trialActive: trialEndsAt !== null && trialEndsAt.getTime() > Date.now(),
    subscriptionStatus: covering?.status ?? null,
    seats: covering ? (covering.seats ?? 1) : null,
  };
}

/**
 * Whether the user may call provider tools right now. Called from the
 * company-resolver choke point with the user's active connection count so no
 * extra query is needed for the seat comparison.
 */
export async function checkEntitlement(
  userId: string,
  activeConnectionCount: number,
): Promise<Entitlement> {
  if (!config.BILLING_ENABLED) return { ok: true };

  const state = await getBillingState(userId);
  if (state.complimentary) return { ok: true };

  if (state.subscriptionStatus !== null) {
    if ((state.seats ?? 1) >= activeConnectionCount) return { ok: true };
    return {
      ok: false,
      reason: "seats_exceeded",
      message:
        `The subscription covers ${state.seats} compan${state.seats === 1 ? "y" : "ies"} but ` +
        `${activeConnectionCount} are connected. Ask the user to update their subscription at ` +
        `${config.BASE_URL}/dashboard (or disconnect a company).`,
    };
  }

  if (state.trialActive) return { ok: true };

  const reason = state.trialEndsAt ? "trial_expired" : "subscription_required";
  return {
    ok: false,
    reason,
    message:
      (reason === "trial_expired"
        ? "The free trial has ended and there is no active subscription. "
        : "This server requires a subscription. ") +
      `Ask the user to subscribe at ${config.BASE_URL}/dashboard to keep using accounting tools.`,
  };
}
