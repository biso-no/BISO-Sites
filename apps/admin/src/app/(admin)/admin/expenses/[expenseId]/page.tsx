import { getExpense } from "@/app/actions/admin";
import { Expense } from "@/lib/types/expense";
import { AdminExpenseDetails } from "./expenseDetails";

export default async function AdminExpenseDetailsPage({
  params,
}: {
  params: Promise<{ expenseId: string }>;
}) {
  const { expenseId } = await params;
  const expenseData = await getExpense(expenseId);
  return <AdminExpenseDetails expenseData={expenseData}></AdminExpenseDetails>;
}
