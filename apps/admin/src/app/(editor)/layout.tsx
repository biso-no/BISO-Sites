import { redirect } from "next/navigation";
import { getUserAuthContext } from "@/lib/authorization";

export default async function EditorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getUserAuthContext();
  if (!ctx) {
    redirect("/auth/login");
  }

  return <>{children}</>;
}
