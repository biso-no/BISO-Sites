import { Models } from "@repo/api";
import { ExpenseAttachment } from "./expenseAttachment";
interface Campus extends Models.Row {
    name: string
}
interface Department extends Models.Row {
    name: string
}
export interface User extends Models.Row {
    name: string
}
export interface Expense extends Models.Row{
    campus: string,
    department: string,
    bank_account: string,
    total: string,
    status: string,
    user:User,
    date:string,
    expenseAttachments: ExpenseAttachment[]
}