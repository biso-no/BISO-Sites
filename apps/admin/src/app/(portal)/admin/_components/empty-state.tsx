import type { ReactNode } from "react";

type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description?: string;
  children?: ReactNode;
};

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
          className="mb-4 w-16 h-16 rounded-2xl flex items-center justify-center"
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
        className="text-base font-medium"
        style={{ color: "rgba(255,255,255,0.60)" }}
      >
        {title}
      </p>
      {description && (
        <p
          className="mt-1 text-sm max-w-xs"
          style={{ color: "rgba(255,255,255,0.30)" }}
        >
          {description}
        </p>
      )}
      {children && <div className="mt-6">{children}</div>}
    </div>
  );
}
