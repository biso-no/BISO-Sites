"use client";

import { Alert, AlertDescription } from "@repo/ui/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

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
        <Alert className="mb-6" variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{t("cart.alerts.checkoutFailed")}</AlertDescription>
        </Alert>
      )}

      {error === "payment_failed" && (
        <Alert className="mb-6" variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{t("cart.alerts.paymentFailed")}</AlertDescription>
        </Alert>
      )}

      {cancelled === "true" && (
        <Alert className="mb-6 border-orange-200 bg-orange-50">
          <AlertCircle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800">
            {t("cart.alerts.cancelled")}
          </AlertDescription>
        </Alert>
      )}
    </>
  );
}
