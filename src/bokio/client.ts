import createClient, { type Client } from "openapi-fetch";
import type { paths } from "./generated/company.js";
import type { accountingConnection } from "../db/schema.js";
import { bokioSettings } from "./settings.js";
import { forceRefreshAccessToken, getValidAccessToken } from "./token-manager.js";

type Connection = typeof accountingConnection.$inferSelect;

export interface BokioApiErrorBody {
  code?: string;
  message?: string;
  bokioErrorId?: string;
  errors?: { field?: string; message?: string }[];
}

/** Normalizes a Bokio apiError body into a readable tool error message. */
export function formatBokioError(status: number, body: BokioApiErrorBody | undefined): string {
  const lines = [`Bokio API error (HTTP ${status}): ${body?.message ?? "unknown error"}`];
  if (body?.code) lines[0] += ` [${body.code}]`;
  for (const fieldError of body?.errors ?? []) {
    lines.push(`  - ${fieldError.field ?? "?"}: ${fieldError.message ?? "?"}`);
  }
  if (body?.bokioErrorId) lines.push(`  (bokioErrorId: ${body.bokioErrorId} — include when contacting Bokio support)`);
  return lines.join("\n");
}

export class BokioApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: BokioApiErrorBody | undefined,
  ) {
    super(formatBokioError(status, body));
  }
}

export type BokioClient = Client<paths>;

/**
 * Typed Bokio Company API client bound to one connection. Injects a valid
 * access token per request and retries exactly once after a 401 (token may
 * have been revoked-and-rotated between our expiry check and the call).
 */
export function createBokioClient(connection: Connection): BokioClient {
  const client = createClient<paths>({ baseUrl: bokioSettings.apiBaseUrl });

  client.use({
    onRequest: async ({ request }) => {
      const token = await getValidAccessToken(connection);
      request.headers.set("Authorization", `Bearer ${token}`);
      request.headers.set("Accept", "application/json");
      return request;
    },
    onResponse: async ({ request, response }) => {
      if (response.status !== 401 || request.headers.get("x-bokio-retried")) return undefined;
      const token = await forceRefreshAccessToken(connection);
      const retry = new Request(request, { headers: new Headers(request.headers) });
      retry.headers.set("Authorization", `Bearer ${token}`);
      retry.headers.set("x-bokio-retried", "1");
      return fetch(retry);
    },
  });

  return client;
}

/** Unwraps an openapi-fetch result, throwing a normalized error on failure. */
export function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (result.response.ok) return result.data as T;
  throw new BokioApiError(result.response.status, result.error as BokioApiErrorBody | undefined);
}
