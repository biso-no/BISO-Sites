import { ExpensesStatus } from "@repo/api/types/appwrite";
import { getFeatureFlagStates } from "@repo/shared/utils/feature-flags-server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCampuses } from "@/app/actions/campus";
import { ExpensesUnavailable } from "@/components/expense/v2/expenses-unavailable";
import { ExpenseSplitView } from "@/components/expense-v3/expense-split-view";
import { getExpenseById } from "@/lib/actions/expense";
import { getLoggedInUser } from "@/lib/actions/user";
import {
  getExpenseTypeOptions,
  startingExpenseTypeOptions,
} from "@/lib/data/expense-types";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("expenses");
  return { title: `${t("composer.title")} | BISO`, description: t("lede") };
}

interface NewExpensePageProps {
  searchParams?: Promise<{
    draftId?: string;
  }>;
}

export default async function NewExpensePage({
  searchParams,
}: NewExpensePageProps) {
  const userData = await getLoggedInUser();

  if (!userData) {
    redirect("/auth/login");
  }

  const flags = await getFeatureFlagStates();
  if (!flags.expenses_module) {
    return <ExpensesUnavailable />;
  }
  const ocrEnabled = flags.expenses_ocr;

  const { draftId } = (await searchParams) ?? {};
  // Three independent reads: load them side by side.
  const [campuses, typeOptions, draftResult] = await Promise.all([
    getCampuses({
      includeNational: true,
      includeDepartments: true, // We need departments for the new selector logic
    }),
    getExpenseTypeOptions().catch((error: unknown) => {
      console.error(
        "Failed to load expense types, using the starting list",
        error
      );
      return startingExpenseTypeOptions();
    }),
    draftId ? getExpenseById(draftId) : null,
  ]);
  const initialDraft =
    draftResult?.success && draftResult.expense?.status === ExpensesStatus.DRAFT
      ? draftResult.expense
      : null;

  return (
    // Offsets the fixed mega-nav (h-20). The split view's own height rules are
    // rebased to `100dvh - 5rem` to match, so it still fills exactly the space
    // left below the nav instead of overflowing past the viewport.
    <div className="pt-20">
      <ExpenseSplitView
        campuses={campuses}
        initialDraft={initialDraft}
        initialProfile={userData.profile || {}}
        ocrEnabled={ocrEnabled}
        typeOptions={typeOptions}
      />
    </div>
  );
}
