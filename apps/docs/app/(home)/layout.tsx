import { SiteHeader } from "components/landing/site-header";
import type { ReactNode } from "react";

/**
 * A plain layout, not Fumadocs' HomeLayout: that wraps the page in its own
 * <main> and a light header the navy logo can't sit on. Search still works
 * here, because the RootProvider in app/layout.tsx provides it.
 */
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      {children}
    </>
  );
}
