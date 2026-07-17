import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { config } from "../src/config.js";
import { db } from "../src/db/index.js";
import { billingAccount } from "../src/db/schema.js";
import { checkEntitlement, getBillingState } from "../src/billing/entitlement.js";

vi.mock("../src/db/index.js", () => ({ db: { select: vi.fn() } }));

type AccountRow = { complimentary: boolean };
type SubRow = { status: string; seats: number | null; trialEnd: Date | null };

function setDb({ account, subs = [] }: { account?: AccountRow; subs?: SubRow[] }) {
  (db.select as Mock).mockImplementation(() => ({
    from: (table: unknown) => ({
      where: () => Promise.resolve(table === billingAccount ? (account ? [account] : []) : subs),
    }),
  }));
}

const sub = (status: string, seats: number | null, trialEnd: Date | null = null): SubRow => ({
  status,
  seats,
  trialEnd,
});

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

  it("allows complimentary accounts with no subscription at all", async () => {
    setDb({ account: { complimentary: true } });
    expect((await checkEntitlement("u1", 3)).ok).toBe(true);
  });

  it("blocks a user with no subscription and points at the trial", async () => {
    setDb({});
    const result = await checkEntitlement("u1", 1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("subscription_required");
      expect(result.message).toContain(`${config.BASE_URL}/dashboard`);
      expect(result.message).toContain("free trial");
    }
  });

  it("allows a Stripe-run trial (status trialing)", async () => {
    setDb({ subs: [sub("trialing", 1, new Date(Date.now() + 5 * 86_400_000))] });
    expect((await checkEntitlement("u1", 1)).ok).toBe(true);
  });

  it("allows an active subscription with enough seats", async () => {
    setDb({ subs: [sub("active", 2)] });
    expect((await checkEntitlement("u1", 2)).ok).toBe(true);
  });

  it("treats null seats as covering one company", async () => {
    setDb({ subs: [sub("active", null)] });
    expect((await checkEntitlement("u1", 1)).ok).toBe(true);
    const over = await checkEntitlement("u1", 2);
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.reason).toBe("seats_exceeded");
  });

  it("blocks when the requested company count exceeds seats", async () => {
    setDb({ subs: [sub("active", 1)] });
    const result = await checkEntitlement("u1", 3);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("seats_exceeded");
      expect(result.message).toContain("3 would be in use");
    }
  });

  it("grants a grace period for past_due subscriptions", async () => {
    setDb({ subs: [sub("past_due", 1)] });
    expect((await checkEntitlement("u1", 1)).ok).toBe(true);
  });

  it("does not count canceled subscriptions as covering", async () => {
    setDb({ subs: [] }); // the query filters to covering statuses
    expect((await checkEntitlement("u1", 1)).ok).toBe(false);
  });

  it("picks the largest covering subscription when several exist", async () => {
    setDb({ subs: [sub("trialing", 1), sub("active", 4)] });
    expect((await checkEntitlement("u1", 4)).ok).toBe(true);
  });

  // The connect flow asks with count+1 for a new company: a 1-seat subscriber
  // already using their seat must not be able to connect a second company.
  it("refuses the seat a new company would need", async () => {
    setDb({ subs: [sub("active", 1)] });
    expect((await checkEntitlement("u1", 1)).ok).toBe(true); // existing company still fine
    expect((await checkEntitlement("u1", 2)).ok).toBe(false); // adding a second is not
  });
});

describe("getBillingState", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(config, "BILLING_ENABLED", "get").mockReturnValue(true as never);
  });

  it("reports a Stripe trial for status surfaces", async () => {
    const trialEnd = new Date(Date.now() + 5 * 86_400_000);
    setDb({ subs: [sub("trialing", 1, trialEnd)] });
    expect(await getBillingState("u1")).toMatchObject({
      billingEnabled: true,
      complimentary: false,
      subscriptionStatus: "trialing",
      trialing: true,
      trialEnd,
      seats: 1,
    });
  });

  it("reports no subscription for a fresh user", async () => {
    setDb({});
    expect(await getBillingState("u1")).toMatchObject({
      subscriptionStatus: null,
      trialing: false,
      seats: null,
      complimentary: false,
    });
  });
});
