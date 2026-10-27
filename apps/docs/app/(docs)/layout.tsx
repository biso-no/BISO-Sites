import { AreaSwitch } from "components/area-switch";
import { DocsLayout } from "fumadocs-ui/layouts/notebook";
import { baseOptions } from "lib/layout.shared";
import { source } from "lib/source";
import type { ReactNode } from "react";

export default function Layout({ children }: { children: ReactNode }) {
  const base = baseOptions();

  return (
    <DocsLayout
      {...base}
      nav={{ ...base.nav, mode: "top" }}
      sidebar={{ banner: <AreaSwitch /> }}
      tabs={false}
      tree={source.pageTree}
    >
      {children}
    </DocsLayout>
  );
}
