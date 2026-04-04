import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  description?: string;
  children?: ReactNode;
};

export function PageHeader({ title, description, children }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-6 mb-8">
      <div>
        <h1
          className="text-3xl font-light tracking-tight"
          style={{ color: "#fff" }}
        >
          {title}
        </h1>
        {description && (
          <p
            className="mt-1 text-sm"
            style={{ color: "rgba(255,255,255,0.45)" }}
          >
            {description}
          </p>
        )}
      </div>
      {children && (
        <div className="flex items-center gap-3 flex-shrink-0">{children}</div>
      )}
    </div>
  );
}
