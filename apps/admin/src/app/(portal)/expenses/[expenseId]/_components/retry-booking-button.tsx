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
import { retryExpenseBooking } from "../actions";

/** Retries a failed ledger booking after a warning about double payment. */
export function RetryBookingButton({ expenseId }: { expenseId: string }) {
  const t = useTranslations("adminPortal.expenses.retry");
  const te = useTranslations("adminPortal.expenses");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const retry = () =>
    startTransition(async () => {
      const result = await retryExpenseBooking({ expenseId });
      setOpen(false);
      if ("error" in result) {
        toast.error(te(`errors.${result.error}`));
      } else if (result.data.status === "success") {
        toast.success(t("booked"));
      } else {
        toast.error(t("failedAgain"));
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
