import { Models } from "@repo/api/server";
import { ExpenseAttachment } from "./expenseAttachment";
export interface Campus extends Models.Row {
    name: string
}
export interface Department extends Models.Row {
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