import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { config } from "../src/config.js";
import { db } from "../src/db/index.js";
import { billingAccount } from "../src/db/schema.js";
import { checkEntitlement, getBillingState } from "../src/billing/entitlement.js";

vi.mock("../src/db/index.js", () => ({ db: { select: vi.fn() } }));

type AccountRow = { trialEndsAt: Date | null; complimentary: boolean };
type SubRow = { status: string; seats: number | null };

function setDb({ account, subs = [] }: { account?: AccountRow; subs?: SubRow[] }) {
  (db.select as Mock).mockImplementation(() => ({
    from: (table: unknown) => ({
      where: () => Promise.resolve(table === billingAccount ? (account ? [account] : []) : subs),
    }),
  }));
}

const inDays = (d: number) => new Date(Date.now() + d * 86_400_000);

describe("checkEntitlement", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(config, "BILLING_ENABLED", "get").mockReturnValue(true as never);
  });

  it("always allows when billing is disabled (no db access)", async () => {
    vi.spyOn(config, "BILLING_ENABLED", "get").mockReturnValue(false as never);
    expect(await checkEntitlement("u1", 5)).toEqual({ ok: true });
    expect(db.select).not.toHaveBeenCalled();
  });

  it("allows complimentary accounts regardless of trial or subscription", async () => {
    setDb({ account: { trialEndsAt: inDays(-30), complimentary: true } });
    expect((await checkEntitlement("u1", 3)).ok).toBe(true);
  });

  it("allows during an active trial", async () => {
    setDb({ account: { trialEndsAt: inDays(3), complimentary: false } });
    expect((await checkEntitlement("u1", 1)).ok).toBe(true);
  });

  it("blocks after trial expiry with a dashboard pointer", async () => {
    setDb({ account: { trialEndsAt: inDays(-1), complimentary: false } });
    const result = await checkEntitlement("u1", 1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("trial_expired");
      expect(result.message).toContain(`${config.BASE_URL}/dashboard`);
    }
  });

  it("blocks users who never had a trial and have no subscription", async () => {
    setDb({});
    const result = await checkEntitlement("u1", 1);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("subscription_required");
  });

  it("allows an active subscription with enough seats, even after trial expiry", async () => {
    setDb({
      account: { trialEndsAt: inDays(-10), complimentary: false },
      subs: [{ status: "active", seats: 2 }],
    });
    expect((await checkEntitlement("u1", 2)).ok).toBe(true);
  });

  it("treats null seats as covering one company", async () => {
    setDb({ subs: [{ status: "active", seats: null }] });
    expect((await checkEntitlement("u1", 1)).ok).toBe(true);
    const over = await checkEntitlement("u1", 2);
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.reason).toBe("seats_exceeded");
  });

  it("blocks when connections exceed subscribed seats", async () => {
    setDb({ subs: [{ status: "active", seats: 1 }] });
    const result = await checkEntitlement("u1", 3);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("seats_exceeded");
      expect(result.message).toContain("3 are connected");
    }
  });

  it("grants a grace period for past_due subscriptions", async () => {
    setDb({ subs: [{ status: "past_due", seats: 1 }] });
    expect((await checkEntitlement("u1", 1)).ok).toBe(true);
  });

  it("picks the largest covering subscription when several exist", async () => {
    setDb({
      subs: [
        { status: "trialing", seats: 1 },
        { status: "active", seats: 4 },
      ],
    });
    expect((await checkEntitlement("u1", 4)).ok).toBe(true);
  });
});

describe("getBillingState", () => {
  it("reports trial and subscription facts for status surfaces", async () => {
    vi.spyOn(config, "BILLING_ENABLED", "get").mockReturnValue(true as never);
    setDb({
      account: { trialEndsAt: inDays(5), complimentary: false },
      subs: [{ status: "active", seats: 2 }],
    });
    const state = await getBillingState("u1");
    expect(state).toMatchObject({
      billingEnabled: true,
      complimentary: false,
      trialActive: true,
      subscriptionStatus: "active",
      seats: 2,
    });
  });
});
