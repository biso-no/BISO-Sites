"use client";

import { cn } from "@repo/ui/lib/utils";
import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import { receiptNotices } from "./receipt-types";
import type { Receipt } from "./store";

/**
 * The receipt check's findings and the duplicate catch, as plain notices.
 * They never block submission; the approver sees them as hints too.
 */
export function ReceiptNotices({
  className,
  compact = false,
  receipt,
}: {
  className?: string;
  /** One small line per notice, for the overview row. */
  compact?: boolean;
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
        "type-body-sm space-y-1 text-ink",
        compact
          ? "text-xs"
          : "rounded-biso-md border border-warning/30 bg-warning/10 p-4",
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
          <span className="min-w-0">{t(notice)}</span>
        </li>
      ))}
    </ul>
  );
}
