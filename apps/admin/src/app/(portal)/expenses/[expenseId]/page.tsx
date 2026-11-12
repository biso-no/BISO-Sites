import { createAdminClient } from "@repo/api/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getUserAuthContext } from "@/lib/authorization";
import { canOpenExpensesSection } from "@/lib/expense-access";
import { getExpenseViewer } from "@/lib/expense-viewer";
import { PageHeader } from "../../_components/page-header";
import { STUDIO, StudioPanel } from "../../_components/studio";
import { getExpenseDetail } from "../expenses-data";
import { ExpenseHeader, ExpenseHints } from "./_components/expense-header";
import { ExpenseHistory } from "./_components/expense-history";
import { ExpenseReceipts } from "./_components/expense-receipts";
import { ExpenseSteps } from "./_components/expense-steps";
import { loadReceiptEditOptions } from "./edit-options";

export default async function ExpenseDetailPage({
  params,
}: {
  params: Promise<{ expenseId: string }>;
}) {
  const [viewer, ctx, { expenseId }] = await Promise.all([
    getExpenseViewer(),
    getUserAuthContext(),
    params,
  ]);
  if (!(viewer && ctx && canOpenExpensesSection(viewer, ctx.roles))) {
    notFound();
  }
  const [t, locale] = await Promise.all([
    getTranslations("adminPortal.expenses"),
    getLocale(),
  ]);
  const detail = await getExpenseDetail(viewer, expenseId, locale);
  if (!detail) {
    notFound();
  }

  const editOptions = detail.permissions.canEdit
    ? await loadReceiptEditOptions((await createAdminClient()).db)
    : null;

  return (
    <div className="pb-12">
      <PageHeader description={detail.submitter.name} title={t("title")}>
        <Link className="text-[13px] underline" href="/expenses">
          {t("detail.back")}
        </Link>
      </PageHeader>
      <ExpenseHeader detail={detail} />
      {detail.status === "failed" && (
        <StudioPanel
          className="mt-4 p-4"
          style={{ borderColor: STUDIO.claret }}
        >
          <h3
            className="font-medium text-[14px]"
            style={{ color: STUDIO.claret }}
          >
            {t("detail.bookingFailureTitle")}
          </h3>
          <p className="mt-1 whitespace-pre-wrap text-[13px]">
            {detail.bookingFailure ?? t("detail.bookingFailureNone")}
          </p>
        </StudioPanel>
      )}
      <ExpenseHints hints={detail.hints} />
      <ExpenseReceipts
        editOptions={editOptions}
        expenseId={detail.id}
        receipts={detail.receipts}
      />
      <ExpenseSteps steps={detail.steps} />
      <ExpenseHistory events={detail.events} />
    </div>
  );
}
