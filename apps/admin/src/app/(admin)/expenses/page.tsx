import { getExpenses } from "@/app/actions/admin";
import { AdminExpenseTable } from "./expense-table";
export default async function AdminExpensePage() {
  const fieldsToSelect = [
    "user.name",
    "department",
    "campus",
    "campusRel.name",
    "departmentRel.Name",
    "$id",
    "user.$id",
    "departmentRel.$id",
    "campusRel.$id",
  ];
  const expenses = await getExpenses(fieldsToSelect);
  console.log(expenses);
  return <AdminExpenseTable expenses={expenses} />;
}
