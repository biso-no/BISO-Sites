import { source } from 'lib/source';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { baseOptions, logo } from 'lib/layout.shared';
import type { ReactNode } from 'react';

export default function Layout({ children }: { children: ReactNode }) {
  const base = baseOptions();

  return (
    <DocsLayout
      {...base}
      tree={source.pageTree}
      nav={{
        ...base.nav,
        title: (
          <>
            {logo}
            <span className="font-medium in-[.uwu]:hidden in-[header]:text-[15px]">
              BISO Sites
            </span>
          </>
        ),
      }}
    >
      {children}
    </DocsLayout>
  );
}
