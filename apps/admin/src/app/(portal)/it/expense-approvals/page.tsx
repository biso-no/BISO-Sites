import { redirect } from "next/navigation";

/** The approval issues moved into Expenses → Needs attention. */
export default function ExpenseApprovalIssuesPage(): never {
  redirect("/expenses?view=attention");
}
