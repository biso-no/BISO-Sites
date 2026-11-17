"use client";

import { cn } from "@repo/ui/lib/utils";
import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import { focusRingClass } from "./form-styles";
import { receiptNotices } from "./receipt-types";
import type { Receipt } from "./store";

/**
 * The receipt check's findings and the duplicate catch, as plain notices.
 * They never block submission; the approver sees them as hints too.
 */
export function ReceiptNotices({
  className,
  compact = false,
  onRetry,
  receipt,
}: {
  className?: string;
  /** One small line per notice, for the overview row. */
  compact?: boolean;
  /** Reads the receipt again; given only when the file is still at hand. */
  onRetry?: () => void;
  receipt: Receipt;
}) {
  const t = useTranslations("expenses.composer.receiptNotices");
  const notices = receiptNotices(receipt);
  if (notices.length === 0) {
    return null;
  }

  return (
    <ul
      className={cn(
        "space-y-1 text-ink",
        compact
          ? "text-xs"
          : "type-body-sm rounded-biso-md border border-warning/30 bg-warning/10 p-4",
        className
      )}
    >
      {notices.map((notice) => (
        <li className="flex items-start gap-1.5" key={notice}>
          <AlertTriangle
            aria-hidden="true"
            className={cn(
              "shrink-0 text-warning",
              compact ? "mt-px size-3" : "mt-0.5 size-3.5"
            )}
          />
          <span className="min-w-0">
            {t(notice)}
            {notice === "scan_failed" && onRetry ? (
              <button
                className={cn(
                  "ml-2 font-semibold underline underline-offset-2",
                  focusRingClass
                )}
                data-row-control=""
                onClick={onRetry}
                type="button"
              >
                {t("retry")}
              </button>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  );
}
