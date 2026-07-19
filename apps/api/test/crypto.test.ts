import { describe, expect, it } from "vitest";
import { decryptToken, encryptToken } from "../src/lib/crypto.js";

describe("token crypto", () => {
  it("roundtrips arbitrary strings", () => {
    for (const secret of ["short", "å-svensk-token-🙂", "x".repeat(4000)]) {
      const stored = encryptToken(secret);
      expect(stored).toMatch(/^v1:/);
      expect(stored).not.toContain(secret);
      expect(decryptToken(stored)).toBe(secret);
    }
  });

  it("produces unique ciphertexts per call (random IV)", () => {
    expect(encryptToken("same")).not.toBe(encryptToken("same"));
  });

  it("rejects tampered ciphertext", () => {
    const stored = encryptToken("secret");
    const parts = stored.split(":");
    const corrupted = Buffer.from(parts[3]!, "base64");
    corrupted[0]! ^= 0xff;
    parts[3] = corrupted.toString("base64");
    expect(() => decryptToken(parts.join(":"))).toThrow();
  });

  it("rejects unknown format versions", () => {
    expect(() => decryptToken("v9:a:b:c")).toThrow(/format/i);
  });
});
