import type { ReactNode } from "react";
import { SERIF_STACK, STUDIO } from "./studio";

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
    <div
      className="flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-24 text-center"
      style={{
        background: "rgba(255,255,255,0.32)",
        borderColor: STUDIO.rule2,
      }}
    >
      {icon && (
        <div
          className="mb-4 flex h-16 w-16 items-center justify-center rounded-xl border"
          style={{
            background: STUDIO.paper2,
            borderColor: STUDIO.rule2,
            color: STUDIO.claret,
          }}
        >
          {icon}
        </div>
      )}
      <p
        className="text-2xl"
        style={{ color: STUDIO.ink, fontFamily: SERIF_STACK }}
      >
        {title}
      </p>
      {description && (
        <p
          className="mt-2 max-w-sm text-sm leading-6"
          style={{ color: STUDIO.ink3 }}
        >
          {description}
        </p>
      )}
      {children && <div className="mt-6">{children}</div>}
    </div>
  );
}
