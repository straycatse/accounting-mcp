import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, isLocale, negotiate } from "../i18n/locales";

describe("negotiate", () => {
  it("matches a bare tag", () => {
    expect(negotiate("sv")).toBe("sv");
    expect(negotiate("en")).toBe("en");
  });

  it("ignores the region subtag", () => {
    expect(negotiate("sv-SE")).toBe("sv");
    expect(negotiate("sv-FI")).toBe("sv");
  });

  it("takes the highest quality, not the first tag", () => {
    // A Swedish browser whose owner prefers English: sv is listed first but
    // ranked lower, and must not win.
    expect(negotiate("sv;q=0.8,en;q=0.9")).toBe("en");
    expect(negotiate("sv-SE,sv;q=0.9,en;q=0.8")).toBe("sv");
  });

  it("skips languages we don't ship", () => {
    expect(negotiate("de-DE,de;q=0.9,sv;q=0.5")).toBe("sv");
    expect(negotiate("de,fr")).toBe(DEFAULT_LOCALE);
  });

  it("ignores tags explicitly refused with q=0", () => {
    expect(negotiate("sv;q=0,en;q=0.5")).toBe("en");
  });

  it("falls back when the header is missing or unparseable", () => {
    expect(negotiate(null)).toBe(DEFAULT_LOCALE);
    expect(negotiate("")).toBe(DEFAULT_LOCALE);
    expect(negotiate(",,;q=")).toBe(DEFAULT_LOCALE);
  });
});

describe("isLocale", () => {
  it("accepts shipped locales only", () => {
    expect(isLocale("sv")).toBe(true);
    expect(isLocale("en")).toBe(true);
    expect(isLocale("sv-SE")).toBe(false);
    expect(isLocale("de")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});
