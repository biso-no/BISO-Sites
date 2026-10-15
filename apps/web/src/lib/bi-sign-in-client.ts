"use client";

import { clientAccount } from "@repo/api/client";

/**
 * Drops any session the browser itself holds with Appwrite before a BI
 * sign-in starts.
 *
 * Appwrite decides at the OAuth callback whether to sign in or to attach the
 * incoming identity to an account, and it decides on the cookie the browser
 * presents for `appwrite.biso.no`, not on this app's own session. Nothing in
 * the app opens such a session any more, but the retired link flow did, and
 * an abandoned attempt left it behind. Left in place it would turn the next
 * BI sign-in on that browser into a link to whatever account it belongs to,
 * which on a shared machine is someone else's.
 */
export async function clearBrowserAppwriteSession(): Promise<void> {
  await clientAccount.deleteSession("current").catch(() => {
    // No browser-side session: the normal case.
  });
}
