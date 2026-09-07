import { SiteShell } from "@/components/layout/site-shell";

// Request-bound gating (session → membership status) lives in the shell, so
// there is no meaningful static shell for it yet. `instant = false` exempts
// THIS segment from instant-navigation validation — the root layout's export
// does not cascade; each segment opts out for itself. Descendant pages remain
// validated. Follow-up: stream membership via Suspense to restore instant
// navigation for the public tree.
export const instant = false;

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SiteShell>{children}</SiteShell>;
}
