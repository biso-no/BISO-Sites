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

// Default error boundary for the authenticated tree. The (protected)
// layout's `unauthorized()` call short-circuits to the unauthorized
// page before this fires, so this only sees true runtime errors from
// authenticated routes.
export default function ProtectedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("common.error");

  useEffect(() => {
    console.error("Protected route error:", error);
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
          <Link className={statusPanelPrimaryAction} href="/profile">
            {t("goToProfile")}
          </Link>
        </>
      }
      body={t("body")}
      icon={<AlertTriangle className="size-8" />}
      title={t("title")}
    />
  );
}
