import { redirect } from "next/navigation";
import { checkNavAccess } from "@/lib/authorization";

export default async function AdminExpensesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const hasAccess = await checkNavAccess("expenses");
  if (!hasAccess) {
    return redirect("/");
  }
  return <>{children}</>;
}
