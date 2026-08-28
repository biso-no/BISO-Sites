"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { endClientAppwriteSession } from "@/lib/account-link-client";

/**
 * Closes the browser-side Appwrite session that an account link had to open.
 *
 * `ensureClientAppwriteSession` gives the browser a session Appwrite can see,
 * because that is the only way an OAuth redirect links an identity instead of
 * creating a user. That session must not outlive the flow: a browser holding
 * an Appwrite session replays it into every later top-level navigation to
 * `appwrite.biso.no`, so a subsequent `admin.biso.no` OAuth sign-in would be
 * attached to this account rather than signing in — the same
 * `409 user_already_exists` failure that forced the session-cookie rename
 * recorded in `LEGACY_SESSION_COOKIE`.
 *
 * Every link return leg lands on `?linked=1` (set by `/api/auth/bi-link`, and
 * by the non-OIDC branch of `IdentityManagement`), so watching for that one
 * marker in the root layout covers all four destinations without each page
 * having to know about it. The identity itself is already persisted and is
 * unaffected by closing the session, and the app's own server-side session in
 * `a_session_biso_web` is a separate thing entirely.
 */
export function AccountLinkSessionCleanup() {
  const searchParams = useSearchParams();
  const linked = searchParams.get("linked") === "1";
  const cleanedUp = useRef(false);

  useEffect(() => {
    if (!linked || cleanedUp.current) {
      return;
    }
    // A ref rather than state: this must fire once per return leg, and
    // re-running it on a re-render would be a pointless extra 401.
    cleanedUp.current = true;
    endClientAppwriteSession().catch(() => {
      // Already swallowed inside; nothing actionable for the visitor here.
    });
  }, [linked]);

  return null;
}
