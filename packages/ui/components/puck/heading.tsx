"use client";

import { cn } from "../../lib/utils";

export type HeadingProps = {
  text: string;
  level?: 1 | 2 | 3 | 4;
  size?: "sm" | "md" | "lg" | "xl";
  align?: "left" | "center";
  id?: string;
};

export function Heading({
  text,
  level = 2,
  size = "lg",
  align = "left",
  id,
}: HeadingProps) {
  const alignClasses = {
    left: "text-left",
    center: "text-center",
  } as const;

  const sizeClasses = {
    sm: "text-2xl",
    md: "text-3xl",
    lg: "text-4xl sm:text-5xl",
    xl: "text-5xl sm:text-6xl",
  } as const;

  const className = cn(
    "w-full font-bold text-foreground tracking-tight",
    sizeClasses[size],
    alignClasses[align]
  );

  const content = text || "";

  if (level === 1) {
    return (
      <h1 className={className} id={id}>
        {content}
      </h1>
    );
  }
  if (level === 3) {
    return (
      <h3 className={className} id={id}>
        {content}
      </h3>
    );
  }
  if (level === 4) {
    return (
      <h4 className={className} id={id}>
        {content}
      </h4>
    );
  }

  return (
    <h2 className={className} id={id}>
      {content}
    </h2>
  );
}

