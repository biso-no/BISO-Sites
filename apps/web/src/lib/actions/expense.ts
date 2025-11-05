"use server"

import { createSessionClient } from "@repo/api/server";

export async function getExpense(expenseId: string) {
    const { db } = await createSessionClient();
    const expense = await db.getRow(
        "app",
        "expense",
        expenseId
    )
    return expense;
}