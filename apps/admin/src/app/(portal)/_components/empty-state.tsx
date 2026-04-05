import type { ReactNode } from "react";

interface EmptyStateProps {
  children?: ReactNode;
  description?: string;
  icon?: ReactNode;
  title: string;
}

export function EmptyState({
  icon,
  title,
  description,
  children,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      {icon && (
        <div
          className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "rgba(255,255,255,0.25)",
          }}
        >
          {icon}
        </div>
      )}
      <p
        className="font-medium text-base"
        style={{ color: "rgba(255,255,255,0.60)" }}
      >
        {title}
      </p>
      {description && (
        <p
          className="mt-1 max-w-xs text-sm"
          style={{ color: "rgba(255,255,255,0.30)" }}
        >
          {description}
        </p>
      )}
      {children && <div className="mt-6">{children}</div>}
    </div>
  );
}
