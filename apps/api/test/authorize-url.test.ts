import { describe, expect, it } from "vitest";
import { buildAuthorizeUrl } from "../src/lib/authorize-url.js";

describe("buildAuthorizeUrl", () => {
  // The bug this exists to prevent: URLSearchParams encodes spaces as "+",
  // and Fortnox reads that literally — the whole scope list becomes one
  // unknown scope and the request fails with invalid_scope.
  it("percent-encodes spaces in scope rather than using +", () => {
    const url = buildAuthorizeUrl("https://apps.fortnox.se/oauth-v1/auth", {
      scope: "companyinformation bookkeeping invoice",
    });
    expect(url).toBe(
      "https://apps.fortnox.se/oauth-v1/auth?scope=companyinformation%20bookkeeping%20invoice",
    );
    expect(url).not.toContain("+");
  });

  it("encodes the redirect_uri and preserves parameter order", () => {
    const url = buildAuthorizeUrl("https://example.test/auth", {
      response_type: "code",
      redirect_uri: "https://web.example.test/connect/fortnox/callback",
      state: "abc-123",
    });
    expect(url).toBe(
      "https://example.test/auth?response_type=code" +
        "&redirect_uri=https%3A%2F%2Fweb.example.test%2Fconnect%2Ffortnox%2Fcallback" +
        "&state=abc-123",
    );
  });

  it("round-trips through a standards-compliant parser", () => {
    const scope = "companyinformation bookkeeping invoice";
    const url = buildAuthorizeUrl("https://example.test/auth", { scope });
    expect(new URL(url).searchParams.get("scope")).toBe(scope);
  });
});
