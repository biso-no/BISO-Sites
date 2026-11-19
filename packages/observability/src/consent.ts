/**
 * Replay consent cookie shared by web and admin. Plain helpers only: no Node
 * built-ins and no `next/*` imports, because the browser reads it too.
 */

export const REPLAY_CONSENT_COOKIE = "biso_replay_consent";
export const REPLAY_CONSENT_VERSION = "v1";

export type ReplayConsent = "granted" | "denied" | "unknown";

const ONE_YEAR_SECONDS = 31_536_000;

function decodeEntry(raw: string): "granted" | "denied" | "unknown" {
  let value: string;
  try {
    // Next's cookies().set percent-encodes the value ("v1:granted" -> "v1%3Agranted").
    value = decodeURIComponent(raw);
  } catch {
    return "unknown";
  }
  if (value === `${REPLAY_CONSENT_VERSION}:granted`) {
    return "granted";
  }
  if (value === `${REPLAY_CONSENT_VERSION}:denied`) {
    return "denied";
  }
  return "unknown";
}

/**
 * Reads the choice from a `Cookie` header or `document.cookie` string. When
 * the cookie appears more than once (host-only plus `.biso.no`), any valid
 * "denied" wins, then any valid "granted", else no answer.
 */
export function parseReplayConsent(
  cookieString: string | undefined
): ReplayConsent {
  if (!cookieString) {
    return "unknown";
  }
  let result: ReplayConsent = "unknown";
  for (const part of cookieString.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name !== REPLAY_CONSENT_COOKIE) {
      continue;
    }
    const entry = decodeEntry(rest.join("="));
    if (entry === "denied") {
      return "denied";
    }
    if (entry === "granted") {
      result = "granted";
    }
  }
  return result;
}

export function serializeReplayConsent(choice: "granted" | "denied"): string {
  return `${REPLAY_CONSENT_VERSION}:${choice}`;
}

export function replayConsentCookieOptions(isProduction: boolean) {
  return {
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
    sameSite: "lax" as const,
    secure: isProduction,
    httpOnly: false,
    domain: isProduction ? ".biso.no" : undefined,
  };
}
