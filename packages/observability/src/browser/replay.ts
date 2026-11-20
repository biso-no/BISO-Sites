/**
 * Session replay for visitors who said yes. Browser-only: no Node built-ins
 * and no server code. `@sentry/nextjs` is imported for types only, so Replay
 * (and the rrweb recorder inside it) loads through the dynamic import below,
 * after consent, never with the page.
 *
 * What a recording may hold is limited in four places, because Replay sends
 * page addresses and DOM attributes that `beforeSend` never sees:
 * 1. `REPLAY_DENYLIST`: pages whose address holds a secret or someone's
 *    personal data are never recorded (checked on consent and on every
 *    navigation).
 * 2. `REPLAY_OPTIONS`: text, inputs and media are masked or blocked, and so
 *    are links that can carry personal data, and frames
 *    (`REPLAY_BLOCKED_ELEMENTS`).
 * 3. `scrubReplayEvent`: the page addresses listed on each replay event lose
 *    their query and fragment.
 * 4. `scrubRecordingEvent`: so do the addresses in the recording's own
 *    navigation, request and breadcrumb entries.
 */
import {
  addHandler,
  type Client,
  type ClientOptions,
  type Event,
  getClient,
} from "@sentry/core";
import type { BrowserClientReplayOptions } from "@sentry/core/browser";
import type { replayIntegration } from "@sentry/nextjs";
import { parseReplayConsent, type ReplayConsent } from "../consent";
import { type ReplayApp, SAMPLE_RATES } from "../options";
import { scrubUrl } from "../scrub";

type ReplayClient = Client<ClientOptions & BrowserClientReplayOptions>;
type ReplayIntegration = ReturnType<typeof replayIntegration>;
type ReplayIntegrationOptions = NonNullable<
  Parameters<typeof replayIntegration>[0]
>;
type RecordingEvent = Parameters<
  NonNullable<ReplayIntegrationOptions["beforeAddRecordingEvent"]>
>[0];

// ---------------------------------------------------------------------------
// 1. Pages that are never recorded
// ---------------------------------------------------------------------------

/**
 * Where Replay never records. rrweb writes the page address into every full
 * snapshot (its Meta `href`), and no hook can rewrite that, so an address
 * holding a secret or someone's personal data must not be recorded at all.
 */
export interface ReplayDenylist {
  /** Path prefixes, matched by whole segments and ignoring case. */
  paths: readonly string[];
  /**
   * Query parameters that hold what someone typed. Any page whose address
   * has one with a value is not recorded; typed text is masked in the
   * recording, and a search copies it into the address.
   */
  queryParams: readonly string[];
}

export const REPLAY_DENYLIST: Record<ReplayApp, ReplayDenylist> = {
  web: {
    paths: [
      // Sign-in. `/auth/verify?userId=…&secret=…` holds a live sign-in
      // secret and shows it again in a `biso://` link; login, callback, oauth
      // and invite carry user ids, secrets and redirect targets.
      "/auth",
      // Expense approval links from email: the path is the approver's token.
      "/fs/approve",
      // Interview booking links from email: the path is the candidate's token.
      "/recruitment/book",
      // Where `/api/payment/return` sends a buyer: the order id, the payment
      // result and the buyer's order.
      "/shop/order",
    ],
    queryParams: [
      // Event, job, news, document, shop and unit search (`?q=`).
      "q",
      "search",
    ],
  },
  admin: {
    paths: [
      // Sign-in: `redirectTo` on the login page, a user id and secret on the
      // OAuth return.
      "/auth",
      // The guest ticket scanner: the path is a live bearer token.
      "/scan",
      // User administration: the search writes the typed name or email to
      // `?q=`, and every page shows other people's accounts.
      "/it/users",
    ],
    queryParams: [
      // Member, user and order search (`?q=`) match names and email
      // addresses; so does the applicant search (`?search=`).
      "q",
      "search",
    ],
  },
};

const REPEATED_SLASHES = /\/{2,}/g;

/** The path as the router would match it: decoded, one slash, lower case. */
const normalizePath = (pathname: string): string => {
  let path = pathname;
  try {
    path = decodeURIComponent(pathname);
  } catch {
    // Keep the raw path; a broken escape can't match a prefix anyway.
  }
  return path.replace(REPEATED_SLASHES, "/").toLowerCase();
};

const underPrefix = (path: string, prefix: string): boolean =>
  path === prefix || path.startsWith(`${prefix}/`);

/** Whether Replay must not record the page at `href` (absolute or a path). */
export function isReplayDenied(app: ReplayApp, href: string): boolean {
  const { paths, queryParams } = REPLAY_DENYLIST[app];
  let url: URL;
  try {
    url = new URL(href, "https://biso.no");
  } catch {
    // An address we can't read is treated as one we must not record.
    return true;
  }
  const path = normalizePath(url.pathname);
  return (
    paths.some((prefix) => underPrefix(path, prefix)) ||
    queryParams.some((name) => Boolean(url.searchParams.get(name)))
  );
}

/** The current page is denylisted. Outside a browser there is no page. */
const deniedHere = (app: ReplayApp): boolean =>
  typeof location !== "undefined" && isReplayDenied(app, location.href);

// ---------------------------------------------------------------------------
// 2–4. What a recording may hold
// ---------------------------------------------------------------------------

/**
 * What a link can point at that may be personal data. rrweb can't mask
 * `href` (or `src`/`srcset`): it turns them into absolute URLs without
 * calling the mask function (`transformAttribute` in @sentry/replay 11.13.0).
 * So these links are blocked instead. Relative links inside the Site stay
 * (`/events/…`); their text is masked like all text.
 */
const PERSONAL_LINK_TARGETS = [
  // An email address.
  '[href^="mailto:" i]',
  // A phone number.
  '[href^="tel:" i]',
  '[href^="sms:" i]',
  // The app's deep links: `/auth/verify` shows
  // `biso://auth/verify?userId=…&secret=…`, a live sign-in secret.
  '[href^="biso:" i]',
  // Absolute links, almost always to another site: an applicant's LinkedIn
  // profile, a Stripe receipt, a SharePoint document.
  '[href^="http" i]',
  '[href^="//"]',
  // A query: searches (`?q=Kari`), tokens and ids.
  '[href*="?"]',
  // An email address anywhere in the link, plain or percent-encoded.
  '[href*="@"]',
  '[href*="%40"]',
];

/**
 * Recorded as an empty box of the same size, without attributes or content:
 * links and image-map areas that can carry personal data, and every frame
 * (rrweb keeps a frame's address as `rr_src`). The SDK's own block list
 * (`.sentry-block`, `[data-sentry-block]`, …) still applies.
 */
export const REPLAY_BLOCKED_ELEMENTS: readonly string[] = [
  ...PERSONAL_LINK_TARGETS.map((target) => `a${target}`),
  ...PERSONAL_LINK_TARGETS.map((target) => `area${target}`),
  "iframe",
];

/** Span ops whose description is a page or request address. */
const ADDRESS_SPAN_OP = /^(?:navigation|resource)\./;

interface RecordingFrame {
  data?: unknown;
  description?: unknown;
  op?: unknown;
}

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined;

/**
 * The recording's own entries (not rrweb's DOM events, which never reach
 * this hook): page loads, navigations and requests are spans described by
 * their full address, a navigation also names the page it left, and some
 * breadcrumbs Replay makes itself carry the page address in `data.url`. All
 * of them keep the address without its query and fragment.
 */
const scrubRecordingEvent = (event: RecordingEvent): RecordingEvent => {
  const frame = event.data.payload as RecordingFrame;
  const data = asRecord(frame.data);
  if (
    event.data.tag === "performanceSpan" &&
    typeof frame.op === "string" &&
    ADDRESS_SPAN_OP.test(frame.op)
  ) {
    if (typeof frame.description === "string") {
      frame.description = scrubUrl(frame.description);
    }
    if (typeof data?.previous === "string") {
      data.previous = scrubUrl(data.previous);
    }
  }
  if (event.data.tag === "breadcrumb" && typeof data?.url === "string") {
    data.url = scrubUrl(data.url);
  }
  return event;
};

const REPLAY_OPTIONS = {
  maskAllText: true,
  maskAllInputs: true,
  blockAllMedia: true,
  // The SDK's three defaults plus every attribute that can hold an address
  // or a description. rrweb turns `href`, `src` and `srcset` into absolute
  // URLs without calling the mask function (`transformAttribute` in
  // @sentry/replay 11.13.0), so those three are listed for a later SDK that
  // does; `REPLAY_BLOCKED_ELEMENTS` is what keeps them out today.
  maskAttributes: [
    "title",
    "placeholder",
    "aria-label",
    "href",
    "src",
    "srcset",
    "alt",
    "action",
    "formaction",
  ],
  block: [...REPLAY_BLOCKED_ELEMENTS],
  // Each page load asks the cookie afresh instead of resuming a stored session.
  stickySession: false,
  // No request or response headers or bodies in recordings.
  networkDetailAllowUrls: [],
  beforeAddRecordingEvent: scrubRecordingEvent,
} satisfies ReplayIntegrationOptions;

/**
 * Replay events list every page address of the recording in `urls`, and
 * `beforeSend` never sees them. `preprocessEvent` runs for them and may
 * change the event in place.
 */
const scrubReplayEvent = (event: Event): void => {
  if (event.type !== "replay_event") {
    return;
  }
  const urls: unknown = (event as { urls?: unknown }).urls;
  if (Array.isArray(urls)) {
    (event as { urls: unknown[] }).urls = urls.map((url) =>
      typeof url === "string" ? scrubUrl(url) : url
    );
  }
  if (typeof event.request?.url === "string") {
    event.request.url = scrubUrl(event.request.url);
  }
};

const clientsWithScrubbing = new WeakSet<ReplayClient>();

const scrubReplayEventsOf = (client: ReplayClient): void => {
  if (clientsWithScrubbing.has(client)) {
    return;
  }
  clientsWithScrubbing.add(client);
  client.on("preprocessEvent", scrubReplayEvent);
};

// ---------------------------------------------------------------------------
// Consent and navigation
// ---------------------------------------------------------------------------

/** The name `getReplay()` looks up; using it keeps Replay's code unloaded. */
const REPLAY_INTEGRATION_NAME = "Replay";

/** The most recent answer, so a load that finishes late can see a "no". */
let latestConsent: ReplayConsent = "unknown";
/** Set while recording is held off because of the page's address. */
let heldForPage = false;
let watchingNavigation = false;
let hasWarned = false;

const warnOnce = (error: unknown): void => {
  if (!hasWarned) {
    hasWarned = true;
    console.warn("[sentry] session replay could not be switched", error);
  }
};

/** A client that sends nothing (no DSN) records nothing either. */
const sendingClient = (): ReplayClient | undefined => {
  const client = getClient<ReplayClient>();
  if (!client?.getDsn() || client.getOptions().enabled === false) {
    return;
  }
  return client;
};

const findReplay = (client: ReplayClient) =>
  client.getIntegrationByName<ReplayIntegration>(REPLAY_INTEGRATION_NAME);

/**
 * Stops at once, without sending the pending part. `stop()` disables the
 * recorder before its first `await`, so nothing more is recorded even though
 * the promise settles later.
 */
const stopNow = (replay: ReplayIntegration | undefined): void => {
  replay?.stop({ flush: false }).catch(warnOnce);
};

/**
 * Starts a stopped Replay again, sampled like a new page load: a full
 * recording for `replaySessions` of visits, otherwise the error buffer.
 * `start()` alone would record every resumed visit in full.
 */
const resume = (replay: ReplayIntegration, app: ReplayApp): void => {
  // `undefined` means stopped; "session" or "buffer" is still running.
  if (replay.getRecordingMode() !== undefined) {
    return;
  }
  const { replaySessions, replayOnError } = SAMPLE_RATES[app];
  if (Math.random() < replaySessions) {
    replay.start();
  } else if (replayOnError > 0) {
    replay.startBuffering();
  }
};

const addReplay = async (client: ReplayClient, app: ReplayApp) => {
  const sentry = await import("@sentry/nextjs");
  // While loading, the visitor may have said no, started to open a page that
  // is not recorded, or another call added it.
  if (
    latestConsent !== "granted" ||
    heldForPage ||
    deniedHere(app) ||
    findReplay(client)
  ) {
    return;
  }
  scrubReplayEventsOf(client);
  // Replay reads both rates from the client once, when it is added, and
  // samples this visit right away.
  const options = client.getOptions();
  options.replaysSessionSampleRate = SAMPLE_RATES[app].replaySessions;
  options.replaysOnErrorSampleRate = SAMPLE_RATES[app].replayOnError;
  client.addIntegration(sentry.replayIntegration(REPLAY_OPTIONS));
};

/** Records on this page if the answer is yes and the page may be recorded. */
const startIfAllowed = async (client: ReplayClient, app: ReplayApp) => {
  heldForPage = false;
  const replay = findReplay(client);
  if (replay) {
    resume(replay, app);
    return;
  }
  await addReplay(client, app);
};

/**
 * After the address has changed: stops on a denylisted page, and starts
 * again on one that may be recorded if the page address was the only reason
 * it was off. A recording the SDK stopped itself (time limit, rate limit) is
 * left alone.
 */
const settleAfterNavigation = async (client: ReplayClient, app: ReplayApp) => {
  if (latestConsent !== "granted") {
    return;
  }
  if (deniedHere(app)) {
    heldForPage = true;
    stopNow(findReplay(client));
    return;
  }
  if (heldForPage) {
    await startIfAllowed(client, app);
  }
};

/**
 * Stops before the browser moves to a denylisted address. Sentry's history
 * handlers run before `pushState`/`replaceState` take effect and before
 * Replay's own handler, which would add the new address to the recording.
 */
const stopForAddress = (app: ReplayApp, href: string | undefined): void => {
  const client = sendingClient();
  if (!(client && href && isReplayDenied(app, href))) {
    return;
  }
  heldForPage = true;
  stopNow(findReplay(client));
};

/**
 * Follows every address change (Next's router uses the History API; Sentry
 * instruments it, and reports back and forward too). Starting again waits a
 * task, until the new address and page are in place.
 */
const watchNavigation = (app: ReplayApp): void => {
  if (watchingNavigation) {
    return;
  }
  watchingNavigation = true;
  addHandler("history", (data: { to?: string }) => {
    try {
      stopForAddress(app, data.to);
      setTimeout(() => {
        const client = sendingClient();
        if (client) {
          settleAfterNavigation(client, app).catch(warnOnce);
        }
      }, 0);
    } catch (error) {
      warnOnce(error);
    }
  });
};

/**
 * Records (sampled) only with a "granted" answer and on a page that may be
 * recorded. "denied" or no answer stops a running recording without sending
 * its pending part. Never throws, and does nothing when Sentry isn't set up.
 */
export async function applyReplayConsent(
  app: ReplayApp,
  consent: ReplayConsent
): Promise<void> {
  try {
    const client = sendingClient();
    if (!client) {
      return;
    }
    latestConsent = consent;
    watchNavigation(app);
    if (consent !== "granted") {
      stopNow(findReplay(client));
      return;
    }
    if (deniedHere(app)) {
      heldForPage = true;
      stopNow(findReplay(client));
      return;
    }
    await startIfAllowed(client, app);
  } catch (error) {
    warnOnce(error);
  }
}

/**
 * The consent bar's answer: saved with `save` (the app's server action), then
 * applied. A "no" stops recording before it is saved, so it holds even if
 * saving fails; a "yes" starts recording only once it is saved. Rejects when
 * saving fails, which keeps the bar open.
 */
export async function chooseReplayConsent(
  app: ReplayApp,
  choice: "granted" | "denied",
  save: (choice: "granted" | "denied") => Promise<void>
): Promise<void> {
  if (choice === "denied") {
    await applyReplayConsent(app, "denied");
    await save("denied");
    return;
  }
  await save("granted");
  await applyReplayConsent(app, "granted");
}

/**
 * For `onRouterTransitionStart` in `instrumentation-client.ts`: stops before
 * the router fetches a denylisted page, whose address the recording would
 * otherwise list among its requests. Starting again waits for the address
 * to change. Never throws.
 */
export function stopReplayBeforeNavigation(app: ReplayApp, href: string): void {
  try {
    stopForAddress(app, href);
  } catch (error) {
    warnOnce(error);
  }
}

/**
 * The visitor's answer as the browser holds it. No answer outside a browser
 * or where reading cookies throws (a sandboxed frame).
 */
export function readConsentFromDocument(): ReplayConsent {
  try {
    return typeof document === "undefined"
      ? "unknown"
      : parseReplayConsent(document.cookie);
  } catch {
    return "unknown";
  }
}
