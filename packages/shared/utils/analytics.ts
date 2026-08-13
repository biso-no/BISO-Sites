/**
 * Shared, framework-agnostic analytics helpers for Umami.
 *
 * Umami's tracker exposes a global `window.umami`. There is intentionally no
 * wrapper component and the literal product name never appears in markup — the
 * `<Script>` tag in each app's root layout is what loads the tracker. These
 * helpers are the single typed seam every app uses to emit *custom* events and
 * to attach a (non-PII) member identity. They no-op safely when tracking is
 * disabled (server render, localhost, or non-production builds) and, when it is
 * enabled but the script hasn't loaded yet, briefly retry instead of dropping
 * the call — so call sites never need their own guards.
 */

/**
 * Every custom event name the apps may emit. Kept as a strict union (no string
 * fallback) so a typo or an unregistered name is a compile error. Names must
 * stay ≤ 50 chars — Umami truncates beyond that.
 */
export type AnalyticsEventName =
  // conversions
  | "purchase"
  | "add_to_cart"
  | "remove_from_cart"
  | "checkout_start"
  | "checkout_provider_selected"
  | "membership_cta_click"
  | "membership_purchase_start"
  | "job_application_step"
  | "job_application_submit"
  | "varsling_submit"
  | "expense_submit"
  | "event_register"
  | "event_ticket_click"
  // engagement
  | "campus_switch"
  | "language_switch"
  | "nav_menu_open"
  | "search"
  | "outbound_click"
  | "document_download"
  | "share"
  // guided tours (emitted from @repo/tours via the admin host)
  | "tour_start"
  | "tour_step_view"
  | "tour_complete"
  | "tour_dismiss";

/** Values Umami accepts on an event's data bag / identify attributes. */
export type AnalyticsValue = string | number | boolean | Array<string | number>;

/** Custom event data / identify attributes. `undefined` values are dropped before send. */
export type AnalyticsData = Record<string, AnalyticsValue | undefined>;

interface UmamiTracker {
  identify: (id: string, data?: Record<string, unknown>) => void;
  track: (name: string, data?: Record<string, unknown>) => void;
}

/** ~10s of bounded polling while the `afterInteractive` script finishes loading. */
const TRACKER_RETRY_MS = 250;
const TRACKER_MAX_ATTEMPTS = 40;

/**
 * Whether tracking should run in this environment: client-side, and either a
 * production build or the explicit `NEXT_PUBLIC_ANALYTICS_DEBUG` opt-in (which
 * keeps prod data clean while still allowing local testing).
 */
function isTrackingEnabled(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const isProduction = process.env.NODE_ENV === "production";
  const isDebug = process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === "true";
  return isProduction || isDebug;
}

function readTracker(): UmamiTracker | undefined {
  return (window as unknown as { umami?: UmamiTracker }).umami;
}

/**
 * Run `action` against the tracker. The `<Script>` loads `afterInteractive`, so
 * on a first page view `window.umami` can still be absent when a mount-only call
 * fires (e.g. `purchase`, `identify`). Rather than silently drop the event —
 * which would lose revenue and leave members anonymous — retry a bounded number
 * of times until the tracker appears, then give up.
 */
function withTracker(action: (tracker: UmamiTracker) => void): void {
  if (!isTrackingEnabled()) {
    return;
  }
  const ready = readTracker();
  if (ready) {
    action(ready);
    return;
  }
  let attempts = 0;
  let timer = 0;
  const tick = () => {
    attempts += 1;
    const tracker = readTracker();
    if (tracker) {
      window.clearInterval(timer);
      action(tracker);
      return;
    }
    if (attempts >= TRACKER_MAX_ATTEMPTS) {
      window.clearInterval(timer);
    }
  };
  timer = window.setInterval(tick, TRACKER_RETRY_MS);
}

/** Drop `undefined` entries so we never send empty keys to Umami. */
function compact(
  data?: AnalyticsData
): Record<string, AnalyticsValue> | undefined {
  if (!data) {
    return;
  }
  const result: Record<string, AnalyticsValue> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}

/** Fire a custom Umami event. No-ops when tracking is disabled for this env. */
export function trackEvent(
  name: AnalyticsEventName,
  data?: AnalyticsData
): void {
  withTracker((tracker) => tracker.track(name, compact(data)));
}

/**
 * Attach a stable, non-PII identity to the current Umami session. Pass the
 * Appwrite account `$id` as `id`; `attributes` must contain NO PII (no name,
 * email, or phone) — names are resolved admin-side from the id.
 */
export function identifyUser(id: string, attributes?: AnalyticsData): void {
  withTracker((tracker) => tracker.identify(id, compact(attributes)));
}

/**
 * Revenue event payload. Currency is always NOK across BISO and `order.total`
 * is already in kroner (major units) — do not convert to øre.
 */
export interface PurchaseEvent {
  campus?: string;
  orderId: string;
  revenue: number;
  type: "membership" | "merch" | "mixed";
}

/** Fire the `purchase` event that drives Umami's Revenue report. */
export function trackPurchase(purchase: PurchaseEvent): void {
  trackEvent("purchase", {
    revenue: purchase.revenue,
    currency: "NOK",
    orderId: purchase.orderId,
    type: purchase.type,
    campus: purchase.campus,
  });
}
