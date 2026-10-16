const TRAILING_SLASHES_RE = /\/+$/;

export interface PublicUrls {
  apiBase: string;
  webBase: string;
}

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim().replace(TRAILING_SLASHES_RE, "");
  return trimmed ? trimmed : undefined;
}

/**
 * The public website origin buyers are sent to (receipt page, cart, membership
 * join flow). In split-host deployments this app has its own
 * NEXT_PUBLIC_BASE_URL, so the web-specific variable wins.
 */
export function webBaseUrl(): string | undefined {
  return (
    clean(process.env.NEXT_PUBLIC_WEB_BASE_URL) ??
    clean(process.env.NEXT_PUBLIC_BASE_URL)
  );
}

/**
 * This API app's own public origin — where payment providers send buyers back
 * to after paying, so reconciliation and settlement run here.
 */
export function apiBaseUrl(): string | undefined {
  return clean(process.env.NEXT_PUBLIC_API_BASE_URL);
}
