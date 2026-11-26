import "server-only";

import { createAdminClient } from "@repo/api/server";
import type { SendDeps } from "@repo/shared/big-events/messages/send";
import { isFeatureEnabled } from "@repo/shared/utils/feature-flags-server";

const TRAILING_SLASHES = /\/+$/;
const DEFAULT_WEB_BASE = "https://biso.no";

/** The SMS switch (spec D9): "Also send as SMS" does nothing while it is off. */
export function isSmsEnabled(): Promise<boolean> {
  return isFeatureEnabled("big_events_sms");
}

/** What the shared send engine needs when admin sends a message right away. */
export async function messageSendDeps(): Promise<SendDeps> {
  const { db, messaging, users } = await createAdminClient();
  const webBase = (
    process.env.WEB_PUBLIC_BASE_URL ??
    process.env.NEXT_PUBLIC_WEB_BASE_URL ??
    DEFAULT_WEB_BASE
  ).replace(TRAILING_SLASHES, "");
  return { db, isSmsEnabled, messaging, users, webBase };
}
