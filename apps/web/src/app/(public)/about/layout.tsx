import type { Metadata } from "next";

// Default metadata for the entire /about/* subtree. Most about pages are
// client components (they use useTranslations on render) so they can't
// export their own metadata; setting it here gives every about page a
// reasonable SEO title instead of inheriting the root layout's generic
// "BI Student Organisation".
export const metadata: Metadata = {
  title: "About BISO | BI Student Organisation",
  description:
    "Learn about BI Student Organisation — who we are, what we do, and how we represent students at BI Norwegian Business School.",
};

export default function AboutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
