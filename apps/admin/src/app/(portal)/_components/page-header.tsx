import type { ReactNode } from "react";
import { StudioLinkButton, StudioPageHeader } from "./studio";

interface PageHeaderProps {
  children?: ReactNode;
  description?: string;
  title: string;
}

export function PageHeader({ title, description, children }: PageHeaderProps) {
  return (
    <StudioPageHeader description={description} title={title}>
      <StudioLinkButton className="px-3 py-2 text-xs" href="/api/units/sync">
        Sync units
      </StudioLinkButton>
      {children}
    </StudioPageHeader>
  );
}
