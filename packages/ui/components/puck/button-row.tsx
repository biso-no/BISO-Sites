"use client";

import Link from "next/link";
import { cn } from "../../lib/utils";
import { Button, type ButtonProps } from "../ui/button";

export type ButtonRowButton = {
  label: string;
  href: string;
  variant?: ButtonProps["variant"];
};

export type ButtonRowProps = {
  buttons: ButtonRowButton[];
  align?: "left" | "center";
  size?: "sm" | "md" | "lg";
};

export function ButtonRow({
  buttons = [],
  align = "left",
  size = "md",
}: ButtonRowProps) {
  const alignClasses = {
    left: "justify-start",
    center: "justify-center",
  } as const;

  const sizeMap = {
    sm: "sm",
    md: "default",
    lg: "lg",
  } as const;

  return (
    <div className={cn("flex flex-wrap gap-3", alignClasses[align])}>
      {buttons.map((btn, index) => (
        <Button
          asChild
          key={`${btn.href}-${index}`}
          size={sizeMap[size]}
          variant={btn.variant ?? "default"}
        >
          <Link href={btn.href}>{btn.label}</Link>
        </Button>
      ))}
    </div>
  );
}

