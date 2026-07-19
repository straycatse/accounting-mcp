import { bokioSettings } from "./settings.js";

export interface BokioTokenResponse {
  tenant_id: string;
  tenant_type: "company" | "general";
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  connection_id?: string;
}

export class BokioOAuthError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
  ) {
    super(`Bokio token request failed (${status}): ${body}`);
  }
}

async function tokenRequest(params: Record<string, string>): Promise<BokioTokenResponse> {
  const basic = Buffer.from(`${bokioSettings.clientId}:${bokioSettings.clientSecret}`).toString("base64");
  const res = await fetch(`${bokioSettings.authBaseUrl}/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams(params),
  });
  if (!res.ok) throw new BokioOAuthError(res.status, await res.text());
  return (await res.json()) as BokioTokenResponse;
}

export const exchangeAuthorizationCode = (code: string, redirectUri: string) =>
  tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri });

export const refreshBokioToken = (refreshToken: string) =>
  tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken });
