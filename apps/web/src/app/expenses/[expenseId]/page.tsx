import { FormProvider } from "./formContext";
import ExpenseView from "./expenseView";

export default async function Expense({ params }: { params: { expenseId: string } }) {

  return (
    <FormProvider>
      <ExpenseView expenseId={params.expenseId} />
    </FormProvider>
  )
    
}
