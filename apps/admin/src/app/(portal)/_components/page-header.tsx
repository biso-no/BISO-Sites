import type { ReactNode } from "react";
import { StudioPageHeader } from "./studio";

interface PageHeaderProps {
  children?: ReactNode;
  description?: string;
  title: string;
}

export function PageHeader({ title, description, children }: PageHeaderProps) {
  return (
    <StudioPageHeader description={description} title={title}>
      {children}
    </StudioPageHeader>
  );
}
