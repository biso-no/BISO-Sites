import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Drugs and Alcohol Policy | BISO",
  description:
    "BISO policy related to drugs and alcohol for events and activities.",
};

export default function DrugsPolicyLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
