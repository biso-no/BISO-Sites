"use client";

import { clientAccount, OAuthProvider } from "@repo/api/client";
import { createClientSessionToken } from "@/lib/actions/user";

const LINK_SCOPES = ["openid", "email", "profile"];

/**
 * Signs the *browser* in to Appwrite, so the OAuth navigation that follows
 * links an identity instead of creating an account.
 *
 * Appwrite supports identity linking through the client SDK only, and only
 * for a caller it can see an active session for. This app signs users in
 * entirely server-side — the session secret lives in the httpOnly
 * `a_session_biso_web` cookie, under a name Appwrite deliberately ignores —
 * so `clientAccount` is unauthenticated by default. Firing
 * `createOAuth2Session` from it does not link: Appwrite finds no session, no
 * user matching the provider email either, and creates a brand-new account.
 *
 * A server-minted one-time token is traded for a session via `createSession`,
 * which is a real XHR and therefore makes Appwrite set its own cookie for
 * `appwrite.biso.no`. The OAuth navigation then carries that cookie.
 *
 * Call this immediately before `createOAuth2Session` for *any* provider —
 * linking a Microsoft/BISO identity has exactly the same requirement.
 */
export async function ensureClientAppwriteSession(): Promise<void> {
  const token = await createClientSessionToken();
  if (!token) {
    throw new Error(
      "Could not verify your sign-in. Please reload the page and try again."
    );
  }

  // A stale client session (an earlier link attempt, or one belonging to a
  // different account) would make Appwrite link the identity to the wrong
  // user. Clear it first; absent one this 401s, which is the expected case.
  await clientAccount.deleteSession("current").catch(() => {
    // No client-side session to clear — the normal path.
  });

  await clientAccount.createSession(token.userId, token.secret);
}

/**
 * Starts the BI (OIDC) link from `returnTo`, session bootstrap included.
 *
 * The scopes and the `/api/auth/bi-link` success URL match every other BI
 * entry point — see that route's doc comment for why the return leg runs the
 * profile sync instead of the destination page.
 */
export async function startBiAccountLink(returnTo: string): Promise<void> {
  await ensureClientAppwriteSession();

  const base = window.location.origin;
  await clientAccount.createOAuth2Session(
    OAuthProvider.Oidc,
    `${base}/api/auth/bi-link?returnTo=${encodeURIComponent(returnTo)}`,
    `${base}${returnTo}?error=oauth_failed`,
    LINK_SCOPES
  );
  // Browser navigates away; nothing after this runs.
}

/**
 * Drops the browser-side Appwrite session opened by
 * {@link ensureClientAppwriteSession}, once the link has come back.
 *
 * The identity survives independently of the session that created it, so
 * this costs nothing — and leaving the session in place would recreate the
 * incident behind `LEGACY_SESSION_COOKIE`: a browser holding an Appwrite
 * session replays it into every later top-level navigation to
 * `appwrite.biso.no`, including `admin.biso.no`'s OAuth sign-in, which then
 * attaches to this account instead of signing in and fails with
 * `409 user_already_exists`. The app's own server-side session in
 * `a_session_biso_web` is a separate thing and is untouched.
 */
export async function endClientAppwriteSession(): Promise<void> {
  await clientAccount.deleteSession("current").catch(() => {
    // Already gone, or never created — nothing to do.
  });
}
