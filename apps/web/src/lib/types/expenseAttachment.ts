import { Models } from "@repo/api/server";



export interface ExpenseAttachment extends Models.Row {
    date:Date,
    url:string,
    amount:number,
    description:string,
    type:string
}