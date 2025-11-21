"use client";
import { clientSideClient } from "@repo/api/client";

export default function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div>{children}</div>;
}
