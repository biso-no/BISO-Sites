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
import { changeExpenseApprover } from "../actions";

/** Sends the current step to another @biso.no approver. */
export function ChangeApproverDialog({
  approvalId,
  expenseId,
}: {
  approvalId: string;
  expenseId: string;
}) {
  const t = useTranslations("adminPortal.expenses.changeApprover");
  const te = useTranslations("adminPortal.expenses");
  const router = useRouter();
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      const result = await changeExpenseApprover({
        approvalId,
        email,
        expenseId,
      });
      if ("error" in result) {
        toast.error(te(`errors.${result.error}`));
        return;
      }
      if (result.data.notified) {
        toast.success(t("changed"));
      } else {
        toast.warning(t("changedNoNotice"));
      }
      if (!result.data.directorySaved) {
        toast.warning(t("directoryNotSaved"));
      }
      setOpen(false);
      setEmail("");
      router.refresh();
    });

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <button className="text-[12px] underline" type="button">
          {t("button")}
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <label className="block text-[13px]" htmlFor={inputId}>
          {t("email")}
        </label>
        <input
          autoComplete="off"
          className="w-full rounded-lg border px-3 py-2 text-[14px]"
          id={inputId}
          inputMode="email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="name@biso.no"
          type="email"
          value={email}
        />
        <p className="text-[12px] opacity-70">{t("directoryNote")}</p>
        <DialogFooter>
          <Button
            disabled={pending || email.trim() === ""}
            onClick={save}
            type="button"
          >
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
