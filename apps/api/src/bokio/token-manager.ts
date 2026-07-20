import { createTokenManager } from "../lib/token-manager.js";
import { BokioOAuthError, refreshBokioToken } from "./oauth.js";

const manager = createTokenManager({
  providerLabel: "Bokio",
  refresh: refreshBokioToken,
  isAuthError: (err) => err instanceof BokioOAuthError && err.status >= 400 && err.status < 500,
});

export const getValidAccessToken = manager.getValidAccessToken;
export const forceRefreshAccessToken = manager.forceRefreshAccessToken;
