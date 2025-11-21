import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { baseOptions, logo } from "lib/layout.shared";
import { source } from "lib/source";
import type { ReactNode } from "react";

export default function Layout({ children }: { children: ReactNode }) {
  const base = baseOptions();

  return (
    <DocsLayout
      {...base}
      nav={{
        ...base.nav,
        title: (
          <>
            {logo}
            <span className="in-[.uwu]:hidden font-medium in-[header]:text-[15px]">
              BISO Sites
            </span>
          </>
        ),
      }}
      tree={source.pageTree}
    >
      {children}
    </DocsLayout>
  );
}
