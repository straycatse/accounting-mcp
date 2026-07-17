import { config } from "../config.js";
import { MOCK_CLIENT_ID, MOCK_CLIENT_SECRET } from "./mock/state.js";

// With BOKIO_MOCK=true everything points at the in-process mock router,
// so the full product is testable without real Bokio credentials.
export const bokioSettings = config.BOKIO_MOCK
  ? {
      clientId: MOCK_CLIENT_ID,
      clientSecret: MOCK_CLIENT_SECRET,
      authBaseUrl: `${config.BASE_URL}/mock/bokio/v1`,
      apiBaseUrl: `${config.BASE_URL}/mock/bokio/v1`,
    }
  : {
      clientId: config.BOKIO_CLIENT_ID,
      clientSecret: config.BOKIO_CLIENT_SECRET,
      authBaseUrl: config.BOKIO_AUTH_BASE_URL,
      apiBaseUrl: config.BOKIO_API_BASE_URL,
    };
