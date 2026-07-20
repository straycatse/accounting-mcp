import { config } from "../config.js";
import { MOCK_CLIENT_ID, MOCK_CLIENT_SECRET } from "./mock/state.js";

// With FORTNOX_MOCK=true everything points at the in-process mock router,
// so the full product is testable without real Fortnox credentials.
// Note: unlike Bokio, Fortnox splits hosts — OAuth on apps.fortnox.se
// (authorize path is /auth, not /authorize), API on api.fortnox.se.
export const fortnoxSettings = config.FORTNOX_MOCK
  ? {
      clientId: MOCK_CLIENT_ID,
      clientSecret: MOCK_CLIENT_SECRET,
      authBaseUrl: `${config.BASE_URL}/mock/fortnox/oauth-v1`,
      apiBaseUrl: `${config.BASE_URL}/mock/fortnox`,
    }
  : {
      clientId: config.FORTNOX_CLIENT_ID,
      clientSecret: config.FORTNOX_CLIENT_SECRET,
      authBaseUrl: config.FORTNOX_AUTH_BASE_URL,
      apiBaseUrl: config.FORTNOX_API_BASE_URL,
    };
