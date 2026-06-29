import type { Metadata } from "next";

// Resources is a client component (uses useTranslations), so metadata lives here.
export const metadata: Metadata = {
  title: "Ressurser | BISO",
  description:
    "Finn alt du trenger som BI-student — støtteordninger, regler, politikk og mer.",
};

export default function ResourcesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
