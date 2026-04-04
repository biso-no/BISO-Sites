import type { ReactNode } from "react";
import Link from "next/link";
interface PageHeaderProps {
  children?: ReactNode;
  description?: string;
  title: string;
}

export function PageHeader({ title, description, children }: PageHeaderProps) {
  return (
    <div className="mb-8 flex items-start justify-between gap-6">
      <div>
        <h1
          className="font-light text-3xl tracking-tight"
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
      <Link href="/api/units/sync" className="text-sm text-[#3DA9E0]">
        Sync units
      </Link>
      {children && (
        <div className="flex shrink-0 items-center gap-3">{children}</div>
      )}
    </div>
  );
}
