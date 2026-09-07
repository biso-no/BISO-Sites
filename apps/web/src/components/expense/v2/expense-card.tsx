import type { ExpenseAttachments } from "@repo/api/types/appwrite";
import { ExpensesStatus } from "@repo/api/types/appwrite";
import { Building2, Calendar, Eye, Paperclip, Pencil } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Pill } from "@/components/ui/pill";
import { expenseStatusVisual } from "./expense-status";

export interface ExpenseCardExpense {
  $createdAt: string;
  $id: string;
  campus: string;
  department: string;
  description: string | null;
  expenseAttachments?: ExpenseAttachments[];
  status: ExpensesStatus;
  total: number;
}

/**
 * One reimbursement in the list.
 *
 * A Server Component now: the previous card was `"use client"` solely to fade
 * itself in with a `delay: index * 0.1` stagger, which also meant the tenth
 * card appeared a full second after the first.
 */
export async function ExpenseCard({
  expense,
  locale,
}: {
  expense: ExpenseCardExpense;
  locale: string;
}) {
  const t = await getTranslations("expenses");
  const visual = expenseStatusVisual(expense.status);
  const attachmentCount = expense.expenseAttachments?.length || 0;
  const isDraft = expense.status === ExpensesStatus.DRAFT;
  const actionHref = isDraft
    ? `/fs/new?draftId=${expense.$id}`
    : `/fs/${expense.$id}`;
  const ActionIcon = isDraft ? Pencil : Eye;
  const submittedDate = new Date(expense.$createdAt).toLocaleDateString(
    locale,
    { year: "numeric", month: "short", day: "numeric" }
  );

  return (
    <li className="rounded-biso-md border border-edge p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="type-heading-card min-w-0 break-words text-ink">
              {expense.description || t("card.untitled")}
            </h2>
            <Pill tone={visual.tone}>
              <visual.Icon aria-hidden="true" className="size-3.5 shrink-0" />
              {t(`status.${visual.key}`)}
            </Pill>
          </div>

          <ul className="type-body-sm mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-ink-muted">
            <li className="flex items-center gap-2">
              <Building2 aria-hidden="true" className="size-4 shrink-0" />
              <span className="min-w-0 break-words">
                {expense.campus} — {expense.department}
              </span>
            </li>
            <li className="flex items-center gap-2">
              <Calendar aria-hidden="true" className="size-4 shrink-0" />
              {isDraft ? t("card.saved") : t("card.submitted")} {submittedDate}
            </li>
            {attachmentCount > 0 ? (
              <li className="flex items-center gap-2">
                <Paperclip aria-hidden="true" className="size-4 shrink-0" />
                {t("card.attachments", { count: attachmentCount })}
              </li>
            ) : null}
          </ul>
        </div>

        <p className="type-data shrink-0 text-2xl text-ink sm:text-right">
          {expense.total.toFixed(2)} NOK
        </p>
      </div>

      <Link
        className="type-body-sm mt-5 inline-flex items-center gap-2 text-ink-accent underline underline-offset-4 hover:no-underline focus-visible:rounded-biso-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        href={actionHref}
      >
        <ActionIcon aria-hidden="true" className="size-4 shrink-0" />
        {isDraft ? t("card.continueDraft") : t("card.viewDetails")}
      </Link>
    </li>
  );
}
