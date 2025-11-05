import { ExpenseWizard } from "./_components/expense-wizard"
import { getLoggedInUser } from "@/lib/actions/user"
import { redirect } from "next/navigation"

export default async function NewExpensePage() {

  const userData = await getLoggedInUser()

  if (!userData?.profile) {
    redirect("/expenses/profile")
  }

  return (
    <div className="min-h-screen p-6 bg-linear-to-br from-gray-50 to-gray-100">
      <ExpenseWizard />
    </div>
  )
} 