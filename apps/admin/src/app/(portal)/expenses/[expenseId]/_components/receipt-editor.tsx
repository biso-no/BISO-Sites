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
import { useLocale, useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { osloDayOf, todayInOslo } from "@/lib/oslo-day";
import { LedgerAccountPicker } from "../../_components/ledger-account-picker";
import type { ExpenseDetailReceipt } from "../../expenses-data";
import { updateExpenseReceipt } from "../actions";
import type { EditAccountOption } from "../edit-options";
import type { ExpenseTypeOption, ReceiptChanges } from "../receipt-edit";

export interface ReceiptEditOptions {
  accounts: EditAccountOption[];
  types: ExpenseTypeOption[];
}

const fieldClass = "w-full rounded-lg border px-3 py-2 text-[14px]";

const AMOUNT_SPACES = /[\s\u00a0\u202f]/g;

/** `1 234,50` (with any kind of space) reads as 1234.5. */
function parseAmount(text: string): number {
  return Number(text.replace(AMOUNT_SPACES, "").replace(",", "."));
}

/** The edit button of one receipt row and its dialog. */
export function ReceiptEditor({
  expenseId,
  options,
  receipt,
}: {
  expenseId: string;
  options: ReceiptEditOptions;
  receipt: ExpenseDetailReceipt;
}) {
  const t = useTranslations("adminPortal.expenses");
  const locale = useLocale();
  const router = useRouter();
  const ids = {
    amount: useId(),
    date: useId(),
    description: useId(),
    type: useId(),
  };
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const initial = {
    accountNumber: receipt.accountNumber,
    amount: receipt.amount === null ? "" : String(receipt.amount),
    costType: receipt.costType ?? "",
    date: osloDayOf(receipt.date) ?? "",
    description: receipt.description ?? "",
  };
  const [draft, setDraft] = useState(initial);

  const reset = (next: boolean) => {
    if (next) {
      setDraft(initial);
    }
    setOpen(next);
  };

  const typeLabel = (type: ExpenseTypeOption) =>
    locale === "no" && type.labelNo ? type.labelNo : type.label;

  const changeType = (slug: string) => {
    const type = options.types.find((candidate) => candidate.slug === slug);
    // The type brings its account; the picker can still override it.
    setDraft({
      ...draft,
      accountNumber: type?.accountNumber ?? draft.accountNumber,
      costType: slug,
    });
  };

  const buildChanges = (): ReceiptChanges => {
    const changes: ReceiptChanges = {};
    if (draft.date !== initial.date) {
      changes.date = draft.date;
    }
    if (draft.description !== initial.description) {
      changes.description = draft.description;
    }
    if (receipt.isSupporting) {
      return changes;
    }
    if (draft.costType !== initial.costType && draft.costType) {
      changes.costType = draft.costType;
    }
    const typeAccount = changes.costType
      ? options.types.find((type) => type.slug === changes.costType)
          ?.accountNumber
      : undefined;
    const baseAccount = typeAccount ?? initial.accountNumber;
    if (draft.accountNumber !== null && draft.accountNumber !== baseAccount) {
      changes.accountNumber = draft.accountNumber;
    }
    if (draft.amount !== initial.amount) {
      changes.amount = parseAmount(draft.amount);
    }
    return changes;
  };

  const save = () =>
    startTransition(async () => {
      const result = await updateExpenseReceipt({
        attachmentId: receipt.id,
        changes: buildChanges(),
        expenseId,
      });
      if ("error" in result) {
        toast.error(t(`errors.${result.error}`));
        return;
      }
      toast.success(t("edit.saved"));
      setOpen(false);
      router.refresh();
    });

  return (
    <Dialog onOpenChange={reset} open={open}>
      <DialogTrigger asChild>
        <button className="text-[12px] underline" type="button">
          {t("edit.edit")}
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("edit.receiptTitle")}</DialogTitle>
          <DialogDescription>{t("edit.receiptDescription")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-[13px]">
          {!receipt.isSupporting && (
            <>
              <div>
                <label htmlFor={ids.type}>{t("edit.type")}</label>
                <select
                  className={fieldClass}
                  id={ids.type}
                  onChange={(event) => changeType(event.target.value)}
                  value={draft.costType}
                >
                  {!options.types.some(
                    (type) => type.slug === draft.costType
                  ) && (
                    // The current value is not on the active list (own text,
                    // or a type since deactivated): show it, never the first type.
                    <option disabled value={draft.costType}>
                      {receipt.costTypeText
                        ? `“${receipt.costTypeText}”`
                        : (receipt.costTypeLabel ??
                          (draft.costType || t("none")))}
                    </option>
                  )}
                  {options.types.map((type) => (
                    <option key={type.slug} value={type.slug}>
                      {typeLabel(type)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <span className="block">{t("edit.account")}</span>
                <LedgerAccountPicker
                  accounts={options.accounts}
                  labels={{
                    account: t("edit.account"),
                    chooseAccount: t("edit.chooseAccount"),
                    noAccountFound: t("edit.noAccountFound"),
                    searchAccount: t("edit.searchAccount"),
                  }}
                  onChange={(accountNumber) =>
                    setDraft({ ...draft, accountNumber })
                  }
                  size="field"
                  value={draft.accountNumber}
                />
              </div>
            </>
          )}
          <div>
            <label htmlFor={ids.date}>{t("receipts.date")}</label>
            <input
              className={fieldClass}
              id={ids.date}
              max={todayInOslo()}
              min="2000-01-01"
              onChange={(event) =>
                setDraft({ ...draft, date: event.target.value })
              }
              type="date"
              value={draft.date}
            />
          </div>
          <div>
            <label htmlFor={ids.description}>{t("receipts.description")}</label>
            <input
              className={fieldClass}
              id={ids.description}
              maxLength={255}
              onChange={(event) =>
                setDraft({ ...draft, description: event.target.value })
              }
              value={draft.description}
            />
          </div>
          {!receipt.isSupporting && (
            <div>
              <label htmlFor={ids.amount}>{t("receipts.amount")}</label>
              <input
                className={fieldClass}
                id={ids.amount}
                inputMode="decimal"
                onChange={(event) =>
                  setDraft({ ...draft, amount: event.target.value })
                }
                value={draft.amount}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button disabled={pending} onClick={save} type="button">
            {t("edit.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
