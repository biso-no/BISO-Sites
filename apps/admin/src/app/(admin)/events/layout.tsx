import { redirect } from "next/navigation";
import { checkNavAccess } from "@/lib/authorization";

export default async function AdminEventsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const hasAccess = await checkNavAccess("events");
  if (!hasAccess) {
    return redirect("/");
  }
  return <>{children}</>;
}
