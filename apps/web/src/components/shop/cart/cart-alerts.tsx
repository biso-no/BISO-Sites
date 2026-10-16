"use client";

import { cn } from "@repo/ui/lib/utils";
import { AlertCircle } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

const NOTICE = "mb-6 flex items-start gap-3 rounded-biso-md border p-4";

function Notice({
  children,
  tone,
}: {
  children: string;
  tone: "danger" | "warning";
}) {
  return (
    <div
      className={cn(
        NOTICE,
        tone === "danger"
          ? "border-danger/30 bg-danger/10"
          : "border-warning/30 bg-warning/10"
      )}
      role={tone === "danger" ? "alert" : "status"}
    >
      <AlertCircle
        aria-hidden="true"
        className={cn(
          "mt-0.5 size-4 shrink-0",
          tone === "danger" ? "text-danger" : "text-warning"
        )}
      />
      <p className="type-body-sm text-ink">{children}</p>
    </div>
  );
}

export function CartAlerts() {
  const t = useTranslations("shop");
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const cancelled = searchParams.get("cancelled");

  if (!(error || cancelled)) {
    return null;
  }

  return (
    <>
      {error === "checkout_failed" && (
        <Notice tone="danger">{t("cart.alerts.checkoutFailed")}</Notice>
      )}

      {error === "payment_failed" && (
        <Notice tone="danger">{t("cart.alerts.paymentFailed")}</Notice>
      )}

      {cancelled === "true" && (
        <Notice tone="warning">{t("cart.alerts.cancelled")}</Notice>
      )}
    </>
  );
}
