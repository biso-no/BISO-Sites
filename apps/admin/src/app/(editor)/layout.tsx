import { requireAdminAccess } from "@/lib/authorization";

export default async function EditorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdminAccess();
  return <>{children}</>;
}
