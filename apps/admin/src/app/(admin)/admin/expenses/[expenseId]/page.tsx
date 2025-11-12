
import {AdminExpenseDetails} from "./expenseDetails"
import {Expense} from "@/lib/types/expense"
import { getExpense } from "@/app/actions/admin";

export default async  function AdminExpenseDetailsPage({ params }: { params: { expenseId: string } }){
    const expenseData = await getExpense(params.expenseId);
    return(
        <AdminExpenseDetails expenseData={expenseData}></AdminExpenseDetails>
    )

}