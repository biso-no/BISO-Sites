"use client";

import { Alert, AlertDescription } from "@repo/ui/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { useSearchParams } from "next/navigation";

export function CartAlerts() {
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
          <AlertDescription>
            Failed to create checkout session. Please try again or contact
            support if the problem persists.
          </AlertDescription>
        </Alert>
      )}

      {error === "payment_failed" && (
        <Alert className="mb-6" variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Payment failed. Please try again or use a different payment method.
          </AlertDescription>
        </Alert>
      )}

      {cancelled === "true" && (
        <Alert className="mb-6 border-orange-200 bg-orange-50">
          <AlertCircle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800">
            Payment was cancelled. Your cart items are still here when
            you&apos;re ready to checkout.
          </AlertDescription>
        </Alert>
      )}
    </>
  );
}
