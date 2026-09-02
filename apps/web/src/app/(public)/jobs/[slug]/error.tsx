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

export default function JobError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("jobs.errors");
  const tError = useTranslations("common.error");

  useEffect(() => {
    console.error("Job page error:", error);
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
            {tError("tryAgain")}
          </button>
          <Link className={statusPanelPrimaryAction} href="/jobs">
            {t("browse")}
          </Link>
        </>
      }
      body={t("body")}
      icon={<AlertTriangle className="size-8" />}
      title={t("title")}
    />
  );
}
