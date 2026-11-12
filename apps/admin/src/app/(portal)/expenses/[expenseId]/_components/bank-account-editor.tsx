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
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { updateExpenseBankAccount } from "../actions";

/** Lets an actor fix the account the student is paid to. */
export function BankAccountEditor({
  bankAccount,
  expenseId,
}: {
  bankAccount: string;
  expenseId: string;
}) {
  const t = useTranslations("adminPortal.expenses.edit");
  const te = useTranslations("adminPortal.expenses");
  const router = useRouter();
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(bankAccount);
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      const result = await updateExpenseBankAccount({
        bankAccount: value,
        expenseId,
      });
      if ("error" in result) {
        toast.error(te(`errors.${result.error}`));
        return;
      }
      toast.success(t("saved"));
      setOpen(false);
      router.refresh();
    });

  return (
    <Dialog
      onOpenChange={(next) => {
        if (next) {
          setValue(bankAccount);
        }
        setOpen(next);
      }}
      open={open}
    >
      <DialogTrigger asChild>
        <button className="ml-2 text-[12px] underline" type="button">
          {t("edit")}
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("bankTitle")}</DialogTitle>
          <DialogDescription>{t("bankDescription")}</DialogDescription>
        </DialogHeader>
        <label className="block text-[13px]" htmlFor={inputId}>
          {t("bankAccount")}
        </label>
        <input
          className="w-full rounded-lg border px-3 py-2 text-[14px]"
          id={inputId}
          inputMode="numeric"
          onChange={(event) => setValue(event.target.value)}
          value={value}
        />
        <p className="text-[12px] opacity-70">{t("bankHint")}</p>
        <DialogFooter>
          <Button disabled={pending} onClick={save} type="button">
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
