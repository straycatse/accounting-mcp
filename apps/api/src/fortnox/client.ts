import createClient, { type Client } from "openapi-fetch";
import type { paths } from "./generated/api.js";
import type { accountingConnection } from "../db/schema.js";
import { fortnoxSettings } from "./settings.js";
import { forceRefreshAccessToken, getValidAccessToken } from "./token-manager.js";

type Connection = typeof accountingConnection.$inferSelect;

// Fortnox wraps errors as { ErrorInformation: {...} }, but the inner field
// capitalization varies across endpoints (Error/Message/Code vs error/message/code).
export interface FortnoxErrorBody {
  ErrorInformation?: {
    Error?: number | string;
    error?: number | string;
    Message?: string;
    message?: string;
    Code?: number | string;
    code?: number | string;
  };
}

/** Normalizes a Fortnox ErrorInformation body into a readable tool error message. */
export function formatFortnoxError(status: number, body: FortnoxErrorBody | undefined): string {
  const info = body?.ErrorInformation;
  const message = info?.Message ?? info?.message ?? "unknown error";
  const code = info?.Code ?? info?.code;
  return `Fortnox API error (HTTP ${status}): ${message}${code !== undefined ? ` [${code}]` : ""}`;
}

export type FortnoxClient = Client<paths>;

/**
 * Typed Fortnox API client bound to one connection. Injects a valid access
 * token per request and retries exactly once after a 401 (token may have
 * been revoked-and-rotated between our expiry check and the call).
 */
export function createFortnoxClient(connection: Connection): FortnoxClient {
  const client = createClient<paths>({ baseUrl: fortnoxSettings.apiBaseUrl });

  client.use({
    onRequest: async ({ request }) => {
      const token = await getValidAccessToken(connection);
      request.headers.set("Authorization", `Bearer ${token}`);
      request.headers.set("Accept", "application/json");
      return request;
    },
    onResponse: async ({ request, response }) => {
      if (response.status !== 401 || request.headers.get("x-fortnox-retried")) return undefined;
      const token = await forceRefreshAccessToken(connection);
      const retry = new Request(request, { headers: new Headers(request.headers) });
      retry.headers.set("Authorization", `Bearer ${token}`);
      retry.headers.set("x-fortnox-retried", "1");
      return fetch(retry);
    },
  });

  return client;
}
