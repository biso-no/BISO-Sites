"use client"
import { useState, useEffect } from "react";
import { ExpenseDetails } from "./expense-details";
import { useFormContext } from "./formContext";
import { getExpense } from "@/app/actions/admin";
import LoadingPage from "./loading-page";

export default function ExpenseView({ expenseId }) {
  const formContext = useFormContext();
  const { updateFormData } = formContext;
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchExpense = async () => {
      if (expenseId !== "new") {
        try {
          const expense = await getExpense(expenseId);
          const ids = expense.expenseAttachments.map((element) => element.$id);
          updateFormData({
            campus: expense.campus,
            department: expense.department,
            bank_account: expense.bank_account,
            description: expense.description,
            expense_attachments: expense.expenseAttachments,
            total: Number(expense.total),
            // If prepayment_amount is needed, uncomment and convert to number
            // prepayment_amount: Number(expense.prepayment_amount),
            expense_attachments_ids: ids,
          });
          console.log("Expense found");
        } catch {
          console.log("Expense with id", expenseId, "does not exist");
        }
      }
      setLoading(false);
    };

     fetchExpense();
  }, [expenseId]);
  //[expenseId, updateFormData]);

  if (loading) {
    return <LoadingPage />
  }

  return <ExpenseDetails expenseId={expenseId}/>;
}
