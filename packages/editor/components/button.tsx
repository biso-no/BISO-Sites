import { buttonVariants } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";
import type { ButtonBlockProps, ButtonSize, ButtonVariant, ContentAlignment } from "../types";

const variantMap: Record<ButtonVariant, string> = {
  primary: "default",
  secondary: "secondary",
  outline: "outline",
};

const sizeMap: Record<ButtonSize, string> = {
  sm: "sm",
  md: "default",
  lg: "lg",
};

const alignWrapper: Record<ContentAlignment, string> = {
  left: "justify-start",
  center: "justify-center",
};

export interface ButtonProps extends ButtonBlockProps {
  className?: string;
}

export function Button({
  label,
  href = "#",
  variant = "primary",
  size = "md",
  newTab,
  align = "left",
  className,
}: ButtonProps) {
  return (
    <div className={cn("flex", alignWrapper[align])}>
      <a
        href={href}
        target={newTab ? "_blank" : undefined}
        rel={newTab ? "noreferrer" : undefined}
        className={cn(
          buttonVariants({
            variant: variantMap[variant],
            size: sizeMap[size],
          }),
          className,
        )}
      >
        {label}
      </a>
    </div>
  );
}
