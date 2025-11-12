import type { PropsWithChildren } from "react";
import { cn } from "@repo/ui/lib/utils";
import type { ContentAlignment, TextSize, TextTone } from "../types";

const sizeMap: Record<TextSize, string> = {
  sm: "text-sm",
  base: "text-base",
  lg: "text-lg",
  xl: "text-xl",
};

const alignmentMap: Record<ContentAlignment, string> = {
  left: "text-left",
  center: "text-center",
};

const toneMap: Record<TextTone, string> = {
  default: "text-slate-700",
  muted: "text-slate-500",
};

export interface TextProps extends PropsWithChildren {
  size?: TextSize;
  align?: ContentAlignment;
  tone?: TextTone;
  className?: string;
}

export function Text({
  size = "base",
  align = "left",
  tone = "default",
  className,
  children,
}: TextProps) {
  return (
    <p
      className={cn(
        "leading-relaxed",
        sizeMap[size],
        alignmentMap[align],
        toneMap[tone],
        className,
      )}
    >
      {children}
    </p>
  );
}
