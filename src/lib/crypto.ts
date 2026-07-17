import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { config } from "../config.js";

const key = Buffer.from(config.TOKEN_ENCRYPTION_KEY, "base64");

// Format: v1:{iv}:{tag}:{ciphertext} (all base64) — versioned for future key rotation.
export function encryptToken(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return `v1:${iv.toString("base64")}:${cipher.getAuthTag().toString("base64")}:${ciphertext.toString("base64")}`;
}

export function decryptToken(stored: string): string {
  const [version, iv, tag, ciphertext] = stored.split(":");
  if (version !== "v1" || !iv || !tag || !ciphertext) {
    throw new Error("Unrecognized encrypted token format");
  }
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
