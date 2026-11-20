/**
 * Session replay for visitors who said yes. Browser-only: no Node built-ins
 * and no server code. `@sentry/nextjs` is imported for types only, so Replay
 * (and the rrweb recorder inside it) loads through the dynamic import below,
 * after consent, never with the page.
 */
import { type Client, type ClientOptions, getClient } from "@sentry/core";
import type { BrowserClientReplayOptions } from "@sentry/core/browser";
import type { replayIntegration } from "@sentry/nextjs";
import { parseReplayConsent, type ReplayConsent } from "../consent";
import { type ReplayApp, SAMPLE_RATES } from "../options";

type ReplayClient = Client<ClientOptions & BrowserClientReplayOptions>;
type ReplayIntegration = ReturnType<typeof replayIntegration>;

/** The name `getReplay()` looks up; using it keeps Replay's code unloaded. */
const REPLAY_INTEGRATION_NAME = "Replay";

const REPLAY_OPTIONS = {
  maskAllText: true,
  maskAllInputs: true,
  blockAllMedia: true,
  // Each page load asks the cookie afresh instead of resuming a stored session.
  stickySession: false,
  // No request or response headers or bodies in recordings.
  networkDetailAllowUrls: [],
};

/** The most recent answer, so a load that finishes late can see a "no". */
let latestConsent: ReplayConsent = "unknown";
let hasWarned = false;

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
  // While loading, the visitor may have said no, or another call added it.
  if (latestConsent !== "granted" || findReplay(client)) {
    return;
  }
  // Replay reads both rates from the client once, when it is added, and
  // samples this visit right away.
  const options = client.getOptions();
  options.replaysSessionSampleRate = SAMPLE_RATES[app].replaySessions;
  options.replaysOnErrorSampleRate = SAMPLE_RATES[app].replayOnError;
  client.addIntegration(sentry.replayIntegration(REPLAY_OPTIONS));
};

/**
 * Records (sampled) only with a "granted" answer. "denied" or no answer
 * stops a running recording without sending its pending part. Never throws,
 * and does nothing when Sentry isn't set up.
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
    const replay = findReplay(client);
    if (consent !== "granted") {
      await replay?.stop({ flush: false });
      return;
    }
    if (replay) {
      resume(replay, app);
      return;
    }
    await addReplay(client, app);
  } catch (error) {
    if (!hasWarned) {
      hasWarned = true;
      console.warn("[sentry] session replay could not be switched", error);
    }
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
