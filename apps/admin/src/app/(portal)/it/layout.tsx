import type { ReactNode } from "react";
import { requireItPagePermission } from "@/lib/it-permissions";

interface ItLayoutProps {
  children: ReactNode;
}

export default async function ItLayout({ children }: ItLayoutProps) {
  await requireItPagePermission("it.users.view");

  return children;
}
