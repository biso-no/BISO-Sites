"use client";

import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { STUDIO, StudioPanel } from "../../../_components/studio";
import { decideExpenseStep } from "../actions";

const MAX_REASON_CHARS = 1000;

interface Props {
  approvalId: string;
  expenseId: string;
  /** The role the viewer decides for when acting on behalf; null when deciding as the approver. */
  onBehalfRole: string | null;
}

/** Approve or reject the current step, as its approver or on their behalf. */
export function DecisionPanel({ approvalId, expenseId, onBehalfRole }: Props) {
  const t = useTranslations("adminPortal.expenses.decision");
  const te = useTranslations("adminPortal.expenses");
  const router = useRouter();
  const reasonId = useId();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  const decide = (decision: "approved" | "rejected") =>
    startTransition(async () => {
      const result = await decideExpenseStep({
        approvalId,
        decision,
        expenseId,
        reason: decision === "rejected" ? reason : undefined,
      });
      if ("error" in result) {
        toast.error(te(`errors.${result.error}`));
        if (result.error === "already_decided") {
          setRejecting(false);
          router.refresh();
        }
        return;
      }
      toast.success(t(decision === "approved" ? "approved" : "rejected"));
      setRejecting(false);
      router.refresh();
    });

  const approveLabel = onBehalfRole
    ? t("approveOnBehalf", { role: onBehalfRole })
    : t("approve");
  const rejectLabel = onBehalfRole
    ? t("rejectOnBehalf", { role: onBehalfRole })
    : t("reject");

  return (
    <StudioPanel className="mt-4 p-4">
      <h3 className="font-medium text-[14px]">{t("title")}</h3>
      {onBehalfRole && (
        <p className="mt-1 text-[13px]" style={{ color: STUDIO.ink3 }}>
          {t("onBehalfHint", { role: onBehalfRole })}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          disabled={pending}
          onClick={() => decide("approved")}
          type="button"
        >
          {approveLabel}
        </Button>
        <Button
          disabled={pending}
          onClick={() => setRejecting(true)}
          type="button"
          variant="outline"
        >
          {rejectLabel}
        </Button>
      </div>
      <Dialog onOpenChange={setRejecting} open={rejecting}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{rejectLabel}</DialogTitle>
            <DialogDescription>{t("rejectDescription")}</DialogDescription>
          </DialogHeader>
          <label className="block text-[13px]" htmlFor={reasonId}>
            {t("reason")}
          </label>
          <Textarea
            id={reasonId}
            maxLength={MAX_REASON_CHARS}
            onChange={(event) => setReason(event.target.value)}
            value={reason}
          />
          <DialogFooter>
            <Button
              disabled={pending || reason.trim() === ""}
              onClick={() => decide("rejected")}
              type="button"
              variant="destructive"
            >
              {rejectLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </StudioPanel>
  );
}
