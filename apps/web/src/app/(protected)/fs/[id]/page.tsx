import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { getLocale } from "@/app/actions/locale";
import { ExpenseDetailSkeleton } from "@/components/expense/expense-skeleton";
import { expenseStatusVisual } from "@/components/expense/v2/expense-status";
import { PageHeader } from "@/components/ui/page-header";
import { Pill } from "@/components/ui/pill";
import { Section } from "@/components/ui/section";
import { SectionHeading } from "@/components/ui/section-heading";
import { getExpenseById } from "@/lib/actions/expense";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("expenses");
  return { title: `${t("title")} | BISO`, description: t("lede") };
}

interface ExpenseDetailsProps {
  params: Promise<{ id: string }>;
}

const APPWRITE_ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
// `.env.example` declares both names and the operations docs still document the
// `_ID` one, so a deployment can legitimately have only that set. The v1 route
// read both; dropping the fallback turned every receipt link into
// `project=undefined` for those deployments. `expense-split-view.tsx` keeps the
// same fallback for the same reason.
const APPWRITE_PROJECT =
  process.env.NEXT_PUBLIC_APPWRITE_PROJECT ||
  process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;

function receiptHref(fileId: string): string {
  return `${APPWRITE_ENDPOINT}/storage/buckets/expenses/files/${fileId}/view?project=${APPWRITE_PROJECT}`;
}

/** A label/value pair in the summary grid; omitted entirely when empty. */
function Fact({
  label,
  mono,
  value,
}: {
  label: string;
  mono?: boolean;
  value: string | null | undefined;
}) {
  if (!value) {
    return null;
  }
  return (
    <div>
      <dt className="type-label text-ink-muted">{label}</dt>
      <dd
        className={`type-body mt-1 min-w-0 break-words text-ink${mono ? "font-mono" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}

async function ExpenseDetails({ expenseId }: { expenseId: string }) {
  const [result, locale, t] = await Promise.all([
    getExpenseById(expenseId),
    getLocale(),
    getTranslations("expenses"),
  ]);

  if (!(result.success && result.expense)) {
    notFound();
  }

  const expense = result.expense;
  const visual = expenseStatusVisual(expense.status);
  const submittedDate = new Date(expense.$createdAt).toLocaleDateString(
    locale,
    { year: "numeric", month: "long", day: "numeric" }
  );
  const attachments = expense.expenseAttachments ?? [];

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: t("title"), href: "/fs" },
          { label: expense.description || t("card.untitled") },
        ]}
        meta={
          <>
            <Pill tone={visual.tone}>
              <visual.Icon aria-hidden="true" className="size-3.5 shrink-0" />
              {t(`status.${visual.key}`)}
            </Pill>
            {/* The total was the largest thing on the old page and sat beside
                a "Total Amount" caption; it is a fact about the claim, so it
                sits with the other facts the title is qualified by. */}
            <Pill>{expense.total.toFixed(2)} NOK</Pill>
          </>
        }
        title={expense.description || t("card.untitled")}
      />

      <Section tone="paper">
        <dl className="grid gap-6 sm:grid-cols-2">
          <Fact label={t("detail.campus")} value={expense.campus} />
          <Fact label={t("detail.department")} value={expense.department} />
          <Fact label={t("detail.submitted")} value={submittedDate} />
          <Fact
            label={t("detail.bankAccount")}
            mono
            value={expense.bank_account}
          />
          <Fact label={t("detail.event")} value={expense.eventName} />
          <Fact
            label={t("detail.prepayment")}
            value={
              expense.prepayment_amount && expense.prepayment_amount > 0
                ? `${expense.prepayment_amount.toFixed(2)} NOK`
                : null
            }
          />
          <Fact
            label={t("detail.invoiceId")}
            mono
            value={
              expense.invoice_id === null || expense.invoice_id === undefined
                ? null
                : String(expense.invoice_id)
            }
          />
        </dl>
      </Section>

      {attachments.length > 0 ? (
        <Section className="border-edge border-t" tone="paper">
          <SectionHeading>
            {t("detail.attachments", { count: attachments.length })}
          </SectionHeading>
          <ul className="grid gap-5 sm:grid-cols-2">
            {attachments.map((attachment) => (
              <li
                className="rounded-biso-md border border-edge p-5"
                key={attachment.$id}
              >
                <h3 className="type-heading-card min-w-0 break-words text-ink">
                  {attachment.description}
                </h3>
                <dl className="mt-4 grid grid-cols-2 gap-4">
                  <Fact
                    label={t("detail.date")}
                    value={
                      attachment.date
                        ? new Date(attachment.date).toLocaleDateString(locale)
                        : null
                    }
                  />
                  <Fact
                    label={t("detail.amount")}
                    value={`${attachment.amount?.toFixed(2) || "0.00"} NOK`}
                  />
                </dl>
                {attachment.url ? (
                  <a
                    className="type-body-sm mt-4 inline-flex items-center gap-2 text-ink-accent underline underline-offset-4 hover:no-underline focus-visible:rounded-biso-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                    href={receiptHref(attachment.url)}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {t("detail.viewReceipt")}
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </>
  );
}

export default async function ExpenseViewPage({ params }: ExpenseDetailsProps) {
  const { id } = await params;

  return (
    <Suspense fallback={<ExpenseDetailSkeleton />}>
      <ExpenseDetails expenseId={id} />
    </Suspense>
  );
}
