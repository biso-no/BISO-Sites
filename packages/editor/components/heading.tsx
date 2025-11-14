import type { PropsWithChildren } from "react";
import { cn } from "@repo/ui/lib/utils";
import type { ContentAlignment, HeadingLevel, HeadingSize } from "../types";

const sizeMap: Record<HeadingSize, string> = {
  xs: "text-base",
  sm: "text-lg",
  md: "text-xl",
  lg: "text-2xl",
  xl: "text-3xl",
  "2xl": "text-4xl",
  "3xl": "text-5xl",
};

const alignmentMap: Record<ContentAlignment, string> = {
  left: "text-left",
  center: "text-center",
};

export interface HeadingProps extends PropsWithChildren {
  as?: HeadingLevel;
  size?: HeadingSize;
  align?: ContentAlignment;
  eyebrow?: string;
  className?: string;
}

export function Heading({
  as = "h2",
  size = "xl",
  align = "left",
  eyebrow,
  className,
  children,
}: HeadingProps) {
  const Component = as;

  return (
    <div className={cn("space-y-2", alignmentMap[align])}>
      {eyebrow ? (
        <span className="text-sm font-semibold uppercase tracking-wider text-primary">
          {eyebrow}
        </span>
      ) : null}
      <Component className={cn("font-semibold text-slate-900", sizeMap[size], className)}>
        {children}
      </Component>
    </div>
  );
}
