"use client";

import { AlertCircle } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import {
  StatusPanel,
  statusPanelPrimaryAction,
  statusPanelSecondaryAction,
} from "@/components/ui/status-panel";

export default function ExpensesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("expenses");

  useEffect(() => {
    console.error("Reimbursements error:", error);
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
          <Link className={statusPanelPrimaryAction} href="/fs">
            {t("back")}
          </Link>
        </>
      }
      body={t("errorBody")}
      icon={<AlertCircle className="size-8" />}
      title={t("errorTitle")}
    />
  );
}
