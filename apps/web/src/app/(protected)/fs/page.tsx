import { isFeatureEnabled } from "@repo/shared/utils/feature-flags-server";
import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { getLocale } from "@/app/actions/locale";
import { ExpenseCard } from "@/components/expense/v2/expense-card";
import { ExpensesUnavailable } from "@/components/expense/v2/expenses-unavailable";
import { ListSkeleton } from "@/components/ui/loading-shell";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { getExpenses } from "@/lib/actions/expense";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("expenses");
  return { title: `${t("title")} | BISO`, description: t("lede") };
}

const primaryAction =
  "type-label inline-flex items-center gap-2 rounded-biso-pill bg-action px-5 py-3 text-action-ink transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

async function ExpenseList() {
  const [result, locale, t] = await Promise.all([
    getExpenses(),
    getLocale(),
    getTranslations("expenses"),
  ]);

  if (!result.success) {
    return (
      <div className="rounded-biso-md border border-danger/40 bg-danger/5 p-6">
        <h2 className="type-heading-card text-danger">
          {t("loadFailedTitle")}
        </h2>
        <p className="type-body mt-2 text-ink-muted">{result.error}</p>
      </div>
    );
  }

  if (result.expenses.length === 0) {
    return (
      <div className="flex flex-col items-start gap-4 rounded-biso-md border border-edge p-10">
        <h2 className="type-heading-card text-ink">{t("emptyTitle")}</h2>
        <p className="type-body max-w-(--measure) text-ink-muted">
          {t("emptyBody")}
        </p>
        <Link className={`mt-2 ${primaryAction}`} href="/fs/new">
          <Plus aria-hidden="true" className="size-4 shrink-0" />
          {t("submitNew")}
        </Link>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-5">
      {result.expenses.map((expense) => (
        <ExpenseCard expense={expense} key={expense.$id} locale={locale} />
      ))}
    </ul>
  );
}

export default async function ExpensesPage() {
  await connection();

  const t = await getTranslations("expenses");

  if (!(await isFeatureEnabled("expenses_module"))) {
    return <ExpensesUnavailable />;
  }

  return (
    <>
      <PageHeader
        actions={
          <Link className={primaryAction} href="/fs/new">
            <Plus aria-hidden="true" className="size-4 shrink-0" />
            {t("submitNew")}
          </Link>
        }
        breadcrumbs={[{ label: t("title") }]}
        lede={t("lede")}
        title={t("title")}
      />

      <Section tone="paper">
        <Suspense fallback={<ListSkeleton />}>
          <ExpenseList />
        </Suspense>
      </Section>
    </>
  );
}
