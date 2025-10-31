// In your page component:
import { getExpense } from "@/app/actions/admin";
import { ExpenseDetailsView } from "./expense-details-view";

export default async function ExpensePage({ params }: { params: { expenseId: string } }) {
  const expense = await getExpense(params.expenseId);
  
  return <ExpenseDetailsView expense={expense} />;
}