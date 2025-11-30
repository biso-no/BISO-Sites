import { redirect } from "next/navigation";
import { getCampuses } from "@/app/actions/campus";
import { ExpenseSplitView } from "@/components/expense-v3/expense-split-view";
import { getLoggedInUser } from "@/lib/actions/user";

export default async function NewExpensePage() {
  const userData = await getLoggedInUser();

  if (!userData) {
    redirect("/auth/login");
  }

  const campuses = await getCampuses({
    includeNational: true,
    includeDepartments: true, // We need departments for the new selector logic
  });

  return (
    <ExpenseSplitView
      campuses={campuses}
      initialProfile={userData.profile || {}}
    />
  );
}
