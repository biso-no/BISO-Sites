import { redirect } from "next/navigation";
import { getCampuses } from "@/app/actions/campus";
import { getLoggedInUser } from "@/lib/actions/user";
import { NewExpenseClient } from "./new-expense-client";

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
    <NewExpenseClient
      campuses={campuses}
      initialProfile={userData.profile || {}}
    />
  );
}
