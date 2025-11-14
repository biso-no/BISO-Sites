import type { PropsWithChildren } from "react";
import { cn } from "@repo/ui/lib/utils";
import type { ContentAlignment, SectionBackground, SectionPadding, SectionWidth } from "../types";

const backgroundMap: Record<SectionBackground, string> = {
  default: "bg-white text-slate-900",
  muted: "bg-slate-100 text-slate-900",
  primary: "bg-primary text-primary-foreground",
};

const widthMap: Record<SectionWidth, string> = {
  default: "max-w-4xl",
  lg: "max-w-5xl",
  xl: "max-w-6xl",
  full: "max-w-none",
};

const paddingMap: Record<SectionPadding, string> = {
  none: "py-0",
  sm: "py-8",
  md: "py-12",
  lg: "py-16",
};

const alignmentMap: Record<ContentAlignment, string> = {
  left: "items-start text-left",
  center: "items-center text-center",
};

export interface SectionProps extends PropsWithChildren {
  background?: SectionBackground;
  width?: SectionWidth;
  padding?: SectionPadding;
  align?: ContentAlignment;
  id?: string;
  className?: string;
  label?: string;
}

export function Section({
  background = "default",
  width = "default",
  padding = "md",
  align = "left",
  id,
  children,
  className,
}: SectionProps) {
  return (
    <section
      id={id}
      className={cn(
        "w-full",
        backgroundMap[background],
        paddingMap[padding],
        className,
      )}
    >
      <div
        className={cn(
          "mx-auto flex w-full flex-col gap-6 px-4 sm:px-6 lg:px-8",
          widthMap[width],
          alignmentMap[align],
        )}
      >
        {children}
      </div>
    </section>
  );
}
