import { ID, InputFile, Models, Query } from "@repo/api";
import type { Users } from "@repo/api/types/appwrite";
import { createAdminClient } from "@repo/api/server";
import { Expenses, ExpenseStatus } from "@repo/api/types/appwrite";
import { NextRequest, NextResponse } from "next/server";
import { createAuthenticatedClient } from "@/lib/auth";
import { generateExpensePdf } from "@/lib/pdf/expense-pdf";

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



/**
 * Generates a 5-digit reimbursement number from the sequence.
 * Base is 10000, sequence is added to the last digits.
 * E.g., sequence 80 -> 10080, sequence 150 -> 10150
 */
function generateReimbursementNumber(sequence: number): string {
  const base = 10000;
  return String(base + sequence).padStart(5, "0");
}

/**
 * Formats a date string for display in Norwegian format
 */
function formatDate(date: Date): string {
  return date.toLocaleDateString("nb-NO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export async function POST(req: NextRequest) {
  try {
    const { db, account } = await createAuthenticatedClient(req);
    const { messaging, storage: adminStorage } = await createAdminClient();
    const user = await account.get();
    const profile = await db.getRow<Users>("app", "user", user.$id);

    const expenseData = await req.json();

    if (!expenseData || !expenseData.bank_account) {
      return NextResponse.json({ success: false, error: "Bank account is required" });
    }

    const expenseBody = {
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
      $sequence: 10000,
    };

    const expense = await db.createRow<CreateExpenseData>(
      "app",
      "expense",
      ID.unique(),
      expenseBody
    );

    const fetchedExpense = await db.getRow<Expenses>("app", "expense", expense.$id, [
      Query.select([
        "$id",
        "campus",
        "department",
        "bank_account",
        "description",
        "total",
        "prepayment_amount",
        "status",
        "invoice_id",
        "user.*",
        "userId",
        "eventName",
        "departmentRel.*",
        "campusRel.*",
        "expenseAttachments.*",
        "$sequence",
      ]),
    ]);

    // Generate reimbursement number from sequence
    const reimbursementNumber = generateReimbursementNumber(fetchedExpense.$sequence);

    // Build address string
    const addressParts = [profile.address, profile.zip, profile.city].filter(Boolean);
    const fullAddress = addressParts.join(", ") || "Ikke oppgitt";

    if (!profile.name || !profile.phone || !profile.email || !profile.bank_account) {
      const missingFields: string[] = [];
      if (!profile.name) missingFields.push("name");
      if (!profile.phone) missingFields.push("phone");
      if (!profile.email) missingFields.push("email");
      if (!profile.bank_account) missingFields.push("bank_account");
      return NextResponse.json({ success: false, error: "Missing required fields: ", missingFields: missingFields.join(", ") });
    }

    // Generate the PDF cover sheet
    const pdfBuffer = await generateExpensePdf({
      reimbursementNumber,
      name: profile.name,
      address: fullAddress,
      phone: profile.phone,
      email: profile.email,
      bankAccount: profile.bank_account,
      invoiceDate: formatDate(new Date()),
      campusAndUnit: `${fetchedExpense.departmentRel.Name} - ${fetchedExpense.campusRel.name}`,
      purpose: fetchedExpense.description ?? "",
      attachments: fetchedExpense.expenseAttachments.map((att) => ({
        description: att.description ?? "",
        date: att.date ? formatDate(new Date(att.date)) : "",
        amount: att.amount ?? 0,
      })),
      subtotal: fetchedExpense.total,
      total: fetchedExpense.total,
    });

    // Upload the PDF to storage
    const pdfFileName = `refusjon-${reimbursementNumber}.pdf`;
    const uploadedPdf = await adminStorage.createFile(
      "expenses",
      ID.unique(),
      InputFile.fromBuffer(pdfBuffer, pdfFileName)
    );

    // Prepend the PDF to the attachments array
    const attachmentsIdsArray = [
      `expenses:${uploadedPdf.$id}`,
      ...fetchedExpense.expenseAttachments.map((attachment) => `expenses:${attachment.url}`),
    ];

    const emailHtml = `
    <h1>Expense received</h1>
    <p>Expense ${expense.$id} has been received</p>
    <p>Reimbursement number: ${reimbursementNumber}</p>
`;

    const invoiceEmailHtml = `
    <h1>Hello,</h1>
    
    <p>${profile.name} has submitted a new reimbursement for ${fetchedExpense.departmentRel.Name} campus ${fetchedExpense.campusRel.name}</p>
    <p>Reimbursement number: ${reimbursementNumber}</p>
    <p>Best regards,</p>
    <p>BISO Invoice</p>
`;

    await messaging.createEmail(
      ID.unique(),
      `Expense ${reimbursementNumber} has been received`,
      emailHtml,
      undefined,
      [user.$id],
      undefined,
      undefined,
      undefined,
      attachmentsIdsArray
    );

    await messaging.createEmail(
      ID.unique(),
      `User ${profile.name} has submitted expense ${reimbursementNumber}`,
      invoiceEmailHtml,
      undefined,
      ["invoice"],
      undefined,
      undefined,
      undefined,
      attachmentsIdsArray
    );

    await db.updateRow<CreateExpenseData>("app", "expense", expense.$id, {
      status: ExpenseStatus.PENDING,
    });

    return NextResponse.json({ success: true, fetchedExpense, reimbursementNumber });
  } catch (error) {
    console.error("Error creating expense:", error);
    return NextResponse.json({ success: false, error });
  }
}