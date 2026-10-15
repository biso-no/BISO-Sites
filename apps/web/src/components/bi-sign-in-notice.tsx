"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  type AccountLinkError,
  readAccountLinkReturn,
} from "@/lib/account-link-return";

/**
 * Message (under `membership.join.needsBiLink`) for each way a BI sign-in
 * can fail to connect the student. Only the two cases the student can act on
 * get their own wording; the rest are "try again" failures.
 */
const LINK_ERROR_MESSAGE_KEYS = {
  already_linked: "alreadyLinked",
  invalid_bi_email: "invalidBiEmail",
  no_bi_identity: "linkFailed",
  not_authenticated: "linkFailed",
  sync_failed: "linkFailed",
} as const satisfies Record<AccountLinkError, string>;

/**
 * Announces a BI sign-in whose student link was refused or failed.
 *
 * `/auth/oauth` lands with `?link_error=<code>` in that case, on whichever
 * page the sign-in was headed for, so one watcher in the root layout covers
 * every destination. Renders nothing.
 */
export function BiSignInNotice() {
  const searchParams = useSearchParams();
  const { error } = readAccountLinkReturn(searchParams);
  const t = useTranslations("membership.join.needsBiLink");
  const handled = useRef(false);

  useEffect(() => {
    if (!error || handled.current) {
      return;
    }
    // A ref rather than state: once per landing, not once per re-render.
    handled.current = true;
    toast.error(t(LINK_ERROR_MESSAGE_KEYS[error]));
  }, [error, t]);

  return null;
}
