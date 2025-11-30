import { redirect } from "next/navigation";
import { getCampuses } from "@/app/actions/campus";
import { ExpenseCanvas } from "@/components/expense-v2/expense-canvas";
import { getLoggedInUser } from "@/lib/actions/user";

export default async function NewExpensePage() {
  const userData = await getLoggedInUser();

  if (!userData) {
    redirect("/auth/login");
  }

  const campuses = await getCampuses({
    includeNational: true,
    includeDepartments: false,
  });

  return (
    <ExpenseCanvas
      campuses={campuses}
      initialProfile={userData.profile || {}}
    />
  );
}
