import { createAuthClient } from "better-auth/react";
import { stripeClient } from "@better-auth/stripe/client";

// No baseURL: requests go to /api/auth on this origin, which Next rewrites to
// the API service — the session cookie stays first-party.
export const authClient = createAuthClient({
  plugins: [stripeClient({ subscription: true })],
});
