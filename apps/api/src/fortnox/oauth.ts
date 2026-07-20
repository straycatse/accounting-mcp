import { fortnoxSettings } from "./settings.js";

// Fortnox token responses carry no tenant id — one token belongs to one
// company; identity comes from GET /3/companyinformation afterwards.
export interface FortnoxTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

export class FortnoxOAuthError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
  ) {
    super(`Fortnox token request failed (${status}): ${body}`);
  }
}

async function tokenRequest(params: Record<string, string>): Promise<FortnoxTokenResponse> {
  const basic = Buffer.from(`${fortnoxSettings.clientId}:${fortnoxSettings.clientSecret}`).toString("base64");
  const res = await fetch(`${fortnoxSettings.authBaseUrl}/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams(params),
  });
  if (!res.ok) throw new FortnoxOAuthError(res.status, await res.text());
  return (await res.json()) as FortnoxTokenResponse;
}

export const exchangeAuthorizationCode = (code: string, redirectUri: string) =>
  tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri });

export const refreshFortnoxToken = (refreshToken: string) =>
  tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken });
