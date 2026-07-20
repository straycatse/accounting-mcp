// Single source of truth for how each accounting provider is presented.
// The API stores `provider` as a lowercase slug ("bokio" | "fortnox"); nothing
// user-facing should render that slug raw.

export type ProviderId = "bokio" | "fortnox";

interface ProviderMeta {
  label: string;
  /** Badge colours — chosen to survive both themes, hence the dark: variants. */
  badgeClass: string;
  /** Solid dot for tab triggers, where a full badge would be too heavy. */
  dotClass: string;
}

export const PROVIDERS: Record<ProviderId, ProviderMeta> = {
  fortnox: {
    label: "Fortnox",
    badgeClass:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
    dotClass: "bg-emerald-600 dark:bg-emerald-400",
  },
  bokio: {
    label: "Bokio",
    badgeClass: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
    dotClass: "bg-blue-600 dark:bg-blue-400",
  },
};

// Connections predate the provider column being constrained, so tolerate an
// unknown slug rather than crashing the list on it.
export function providerMeta(provider: string): ProviderMeta {
  return (
    PROVIDERS[provider as ProviderId] ?? {
      label: provider,
      badgeClass: "bg-muted text-muted-foreground",
      dotClass: "bg-muted-foreground",
    }
  );
}
