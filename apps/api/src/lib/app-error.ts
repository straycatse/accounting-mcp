/**
 * An error whose user-facing text lives in the *web app's* message catalogs
 * rather than here.
 *
 * The API has no message catalogs and no notion of the reader's language: the
 * locale is a cookie on the web origin. So anything the browser will render is
 * shipped as a stable key plus its interpolation params, and translated in
 * apps/web (see lib/trpc-error.ts). Prose that an *LLM* reads — MCP tool
 * results — stays plain English and does not go through this.
 */
export interface MessageKey {
  key: string;
  params?: Record<string, string | number>;
}

export class AppError extends Error implements MessageKey {
  readonly key: string;
  readonly params?: Record<string, string | number>;

  constructor({ key, params }: MessageKey, fallbackMessage: string) {
    // `message` is the English fallback for non-browser callers and logs; the
    // web app prefers the key whenever it recognises it.
    super(fallbackMessage);
    this.name = "AppError";
    this.key = key;
    this.params = params;
  }
}

export function isMessageKey(value: unknown): value is MessageKey {
  return (
    typeof value === "object" &&
    value !== null &&
    "key" in value &&
    typeof (value as MessageKey).key === "string"
  );
}
