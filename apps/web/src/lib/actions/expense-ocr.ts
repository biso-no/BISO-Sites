"use server";

interface ReceiptSummaryInput {
  amount?: number;
  date?: string;
  description?: string;
}

interface ReceiptProcessResult {
  data: {
    amount: number | null;
    date: string | null;
    description: string | null;
  };
  success: boolean;
}

export async function processReceipt(
  _fileId: string,
  _fileUrl: string
): Promise<ReceiptProcessResult> {
  return await Promise.resolve({
    success: true,
    data: {
      amount: null,
      date: null,
      description: null,
    },
  });
}

export async function generateExpenseDescription(
  receipts: ReceiptSummaryInput[]
): Promise<{ description?: string; success: boolean }> {
  const total = receipts.reduce(
    (sum, receipt) => sum + (receipt.amount ?? 0),
    0
  );
  const descriptions = receipts
    .map((receipt) => receipt.description?.trim())
    .filter((description): description is string => Boolean(description));

  return await Promise.resolve({
    success: true,
    description:
      descriptions.length > 0
        ? `${descriptions.join(", ")}. Total: ${total.toLocaleString("nb-NO")} NOK.`
        : `Expense reimbursement. Total: ${total.toLocaleString("nb-NO")} NOK.`,
  });
}
