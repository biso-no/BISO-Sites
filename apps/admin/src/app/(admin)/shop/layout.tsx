import { redirect } from "next/navigation";
import { checkNavAccess } from "@/lib/authorization";

export default async function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const hasAccess = await checkNavAccess("shop");
  if (!hasAccess) {
    return redirect("/");
  }
  return <>{children}</>;
}
