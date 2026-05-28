import type { Metadata } from "next";

// The /safety page is a client component (uses useState/useEffect for the
// reporting form) so it can't export its own metadata. Define it here at
// the layout level instead.
export const metadata: Metadata = {
  title: "Safety & Whistleblowing | BISO",
  description:
    "Report concerns confidentially and learn about BISO's safety and whistleblowing channels.",
};

export default function SafetyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
