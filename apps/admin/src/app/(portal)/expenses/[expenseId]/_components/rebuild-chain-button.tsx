"use client";

import { Button } from "@repo/ui/components/ui/button";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import { rebuildExpenseChain } from "../actions";

/** Builds the approval chain again when the expense was left with no steps. */
export function RebuildChainButton({ expenseId }: { expenseId: string }) {
  const t = useTranslations("adminPortal.expenses");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const rebuild = () =>
    startTransition(async () => {
      const result = await rebuildExpenseChain(expenseId);
      if ("error" in result) {
        toast.error(t(`errors.${result.error}`));
      } else if (result.data.stepsCreated === 0) {
        toast.warning(t("rebuild.noneFound"));
      } else {
        toast.success(t("rebuild.done"));
      }
      router.refresh();
    });

  return (
    <Button
      disabled={pending}
      onClick={rebuild}
      size="sm"
      type="button"
      variant="outline"
    >
      {t("rebuild.button")}
    </Button>
  );
}
