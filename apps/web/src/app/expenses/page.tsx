import { ExpenseTable } from "./expense-table";
import { getExpensesByLoggedInUser } from "@/app/actions/admin";

export default async function Expenses() {
  const expenses = await getExpensesByLoggedInUser()
  return (
    <div className="space-y-6">
      <ExpenseTable expenses={expenses} />
    </div>
  )
}