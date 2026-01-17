import { redirect } from "next/navigation";
import { checkNavAccess } from "@/lib/authorization";

export default async function UsersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const hasAccess = await checkNavAccess("users");
  if (!hasAccess) {
    return redirect("/");
  }
  return <>{children}</>;
}
