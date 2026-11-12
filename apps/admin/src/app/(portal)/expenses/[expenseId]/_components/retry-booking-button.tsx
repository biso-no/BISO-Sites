"use client";

import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/components/ui/dialog";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { ExpenseActionError } from "../../action-result";
import { retryExpenseBooking } from "../actions";

/** Retries a failed ledger booking after a warning about double payment. */
export function RetryBookingButton({ expenseId }: { expenseId: string }) {
  const t = useTranslations("adminPortal.expenses.retry");
  const te = useTranslations("adminPortal.expenses");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const retryErrorMessage = (result: {
    error: ExpenseActionError;
    message?: string;
  }): string => {
    if (result.error === "booking_failed" && result.message) {
      return `${t("failedAgain")} ${result.message}`;
    }
    // An unanswered call may still have booked: say so, not "Try again".
    return result.error === "api_failed"
      ? t("apiFailed")
      : te(`errors.${result.error}`);
  };

  const retry = () =>
    startTransition(async () => {
      const result = await retryExpenseBooking({ expenseId });
      setOpen(false);
      if ("error" in result) {
        toast.error(retryErrorMessage(result));
      } else if (result.data.status === "success") {
        toast.success(t("booked"));
      } else if (result.data.status === "failed") {
        toast.error(t("failedAgain"));
      } else {
        toast.warning(t("inProgress"));
      }
      router.refresh();
    });

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          {t("button")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("warning")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            disabled={pending}
            onClick={retry}
            type="button"
            variant="destructive"
          >
            {t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
