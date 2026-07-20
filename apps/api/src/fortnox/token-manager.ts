import { createTokenManager } from "../lib/token-manager.js";
import { FortnoxOAuthError, refreshFortnoxToken } from "./oauth.js";

// Fortnox refresh tokens are single-use and rotate on every refresh (~45-day
// life); the shared manager persists the rotated token under a per-connection
// mutex, which is what keeps concurrent tool calls from bricking a connection.
const manager = createTokenManager({
  providerLabel: "Fortnox",
  refresh: refreshFortnoxToken,
  isAuthError: (err) => err instanceof FortnoxOAuthError && err.status >= 400 && err.status < 500,
});

export const getValidAccessToken = manager.getValidAccessToken;
export const forceRefreshAccessToken = manager.forceRefreshAccessToken;
