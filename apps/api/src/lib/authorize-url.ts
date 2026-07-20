/**
 * Builds an OAuth authorize URL with query encoding that strict providers accept.
 *
 * Not just sugar over URLSearchParams: that serializes spaces as "+", which is
 * only correct for application/x-www-form-urlencoded *bodies*. RFC 6749 wants
 * the authorize request's space-delimited `scope` percent-encoded, and a strict
 * server reads a "+" literally — so the whole scope list arrives as one unknown
 * scope. Fortnox does exactly this and answers invalid_scope ("An unsupported
 * scope was requested") even when every individual scope is valid, which is
 * near-impossible to diagnose from the error alone.
 *
 * encodeURIComponent emits %20, which every provider accepts.
 */
export function buildAuthorizeUrl(base: string, params: Record<string, string>): string {
  const query = Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
  return `${base}?${query}`;
}
