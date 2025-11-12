
import {AdminExpenseTable} from "./expense-table";
import { getExpenses } from "@/app/actions/admin";
export default async function AdminExpensePage(){
    const expenses = await getExpenses()
    console.log(expenses)
    return <AdminExpenseTable expenses={expenses} />

}