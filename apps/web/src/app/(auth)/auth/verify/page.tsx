import { cn } from "@repo/ui/lib/utils";
import type { Metadata } from "next";
import Link from "next/link";
import {
  statusPanelPrimaryAction,
  statusPanelSecondaryAction,
} from "@/components/ui/status-panel";

// The URL carries a sign-in secret that is still valid here: never send it on
// as a Referer, from the "sign in on the website" link or anything else.
// Analytics drops the query string itself (`@/lib/analytics-privacy`).
export const metadata: Metadata = {
  referrer: "no-referrer",
};

// Shown when the emailed app sign-in link opens in a browser instead of the
// BISO app. It never consumes the token: it only offers the custom-scheme
// link the app handles.
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    userId?: string | string[];
    secret?: string | string[];
  }>;
}) {
  const { userId, secret } = await searchParams;

  const appLink =
    typeof userId === "string" && userId && typeof secret === "string" && secret
      ? `biso://auth/verify?${new URLSearchParams({ userId, secret }).toString()}`
      : null;

  return (
    // Same shell as `/auth/login`: `(auth)` renders outside `SiteShell`, so
    // the card is the page.
    <div className="flex min-h-screen items-center justify-center bg-surface px-4 py-12">
      <div className="w-full max-w-md rounded-biso-lg border border-edge bg-surface p-8">
        <h1 className="type-display-sm break-words text-center text-ink">
          Open BISO to finish signing in
        </h1>
        <p className="type-body mt-2 mb-8 text-center text-ink-muted">
          This sign-in link belongs to the BISO app. If the app did not open,
          open this email on the phone where BISO is installed.
        </p>

        <div className="flex flex-col gap-3">
          {appLink ? (
            <a
              className={cn(statusPanelPrimaryAction, "w-full justify-center")}
              href={appLink}
            >
              Open the BISO app
            </a>
          ) : null}

          <Link
            className={cn(statusPanelSecondaryAction, "w-full justify-center")}
            href="/auth/login"
          >
            Sign in on the website instead
          </Link>
        </div>
      </div>
    </div>
  );
}
