"use client";

import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import {
  StatusPanel,
  statusPanelPrimaryAction,
  statusPanelSecondaryAction,
} from "@/components/ui/status-panel";

// Default error boundary for the public site. More specific boundaries
// (e.g. (public)/jobs/[slug]/error.tsx) take precedence inside their
// own segment; everything else falls back to this one so a thrown
// error in a Server Component renders a styled page instead of the
// default Next.js error UI.
export default function PublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("common.error");

  useEffect(() => {
    console.error("Public route error:", error);
  }, [error]);

  return (
    <StatusPanel
      actions={
        <>
          <button
            className={statusPanelSecondaryAction}
            onClick={reset}
            type="button"
          >
            {t("tryAgain")}
          </button>
          <Link className={statusPanelPrimaryAction} href="/">
            {t("goHome")}
          </Link>
        </>
      }
      body={t("body")}
      icon={<AlertTriangle className="size-8" />}
      title={t("title")}
    />
  );
}
