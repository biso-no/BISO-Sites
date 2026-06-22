import { ExpensesStatus } from "@repo/api/types/appwrite";
import { getFeatureFlagStates } from "@repo/shared/utils/feature-flags-server";
import { redirect } from "next/navigation";
import { getCampuses } from "@/app/actions/campus";
import { ExpensesUnavailable } from "@/components/expense/expenses-unavailable";
import { ExpenseSplitView } from "@/components/expense-v3/expense-split-view";
import { getExpenseById } from "@/lib/actions/expense";
import { getLoggedInUser } from "@/lib/actions/user";

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
  const campuses = await getCampuses({
    includeNational: true,
    includeDepartments: true, // We need departments for the new selector logic
  });
  const draftResult = draftId ? await getExpenseById(draftId) : null;
  const initialDraft =
    draftResult?.success && draftResult.expense?.status === ExpensesStatus.DRAFT
      ? draftResult.expense
      : null;

  return (
    <ExpenseSplitView
      campuses={campuses}
      initialDraft={initialDraft}
      initialProfile={userData.profile || {}}
      ocrEnabled={ocrEnabled}
    />
  );
}
