import { getExpense } from "@/app/actions/admin";
import { AdminExpenseDetails } from "./expense-details";

export default async function AdminExpenseDetailsPage({
  params,
}: {
  params: Promise<{ expenseId: string }>;
}) {
  const { expenseId } = await params;
  const expenseData = await getExpense(expenseId);
  return <AdminExpenseDetails expenseData={expenseData} />;
}
