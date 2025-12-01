import { ID, Models } from "@repo/api";
import type { Users } from "@repo/api/types/appwrite";
import { createSessionClient, createAdminClient } from "@repo/api/server";
import { Expenses, ExpenseStatus } from "@repo/api/types/appwrite";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

type CreateAttachmentData = {
  date: string;
  url: string;
  amount: number;
  description: string;
  type: string;
}

export type CreateExpenseData = Models.Row & {
    campus: string;
    department: string;
    bank_account: string;
    description: string;
    total: number;
    prepayment_amount: number;
    eventName: string;
    expenseAttachments: CreateAttachmentData[];
    campusRel: string;
    departmentRel: string;
    status: ExpenseStatus;
    userId: string;
    user: string;
    $sequence: number;
}



export async function POST(req: NextRequest) {
  try {
    //Get a_session_biso from cookies
    const session = (await cookies()).get("a_session_biso");

    const { db, account } = await createSessionClient(session?.value);
    const { messaging } = await createAdminClient();
    const user = await account.get();
    const profile = await db.getRow<Users>("app", "users", user.$id);

    const expenseData = await req.json();

    if (!expenseData || !expenseData.bank_account) {
      return NextResponse.json({ success: false, error: "Bank account is required" });
    }
    

    const expense = await db.createRow<CreateExpenseData>(
      "app",
      "expense",
      ID.unique(),
      {
        campus: expenseData.campus,
        department: expenseData.department,
        bank_account: expenseData.bank_account,
        description: expenseData.description,
        total: expenseData.total,
        prepayment_amount: expenseData.prepayment_amount,
        status: ExpenseStatus.DRAFT,
        userId: user.$id,
        user: user.$id,
        eventName: expenseData.eventName || null,
        expenseAttachments: expenseData.expenseAttachments,
        campusRel: expenseData.campus,
        departmentRel: expenseData.department,
        $sequence: 10000
      }
    );
    
    const fetchedExpense = await db.getRow<Expenses>("app", "expense", expense.$id);

    const emailHtml = `
    <h1>Expense received</h1>
    <p>Expense ${expense.$id} has been received</p>
`;

    const invoiceEmailHtml = `
    <h1>Hello,</h1>
    
    <p>${profile.name} has submitted a new reimbursement for ${fetchedExpense.departmentRel.Name} campus ${fetchedExpense.campusRel.name}</p>
    <p>Best regards,</p>
    <p>BISO Invoice</p>
`;

    await messaging.createEmail(
      ID.unique(),
      `Expense ${expense.$id} has been received`,
      emailHtml,
      undefined,
      [user.$id]
    );

    await messaging.createEmail(
        ID.unique(),
        `User ${profile.name} has submitted an expense`,
        invoiceEmailHtml,
        undefined,
        ['invoice']
    )

    await db.updateRow<CreateExpenseData>(
      "app",
      "expense",
      expense.$id,
      {
        status: ExpenseStatus.PENDING,
      }
    );

    return NextResponse.json({ success: true, fetchedExpense });
  } catch (error) {
    console.error("Error creating expense:", error);
    return NextResponse.json({ success: false, error });
  }
}