import { redirect } from "next/navigation";
import { checkNavAccess } from "@/lib/authorization";

export default async function PostsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const hasAccess = await checkNavAccess("posts");
  if (!hasAccess) {
    return redirect("/");
  }
  return <>{children}</>;
}
