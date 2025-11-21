"use client";

import { Slot } from "@radix-ui/react-slot";
import { cn } from "@repo/ui/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md font-medium text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/92",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-border bg-transparent text-foreground hover:bg-muted/40",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/90",
        ghost: "text-foreground hover:bg-muted/30",
        link: "text-accent underline-offset-4 hover:underline",
        glass:
          "glass border border-white/10 text-foreground shadow-md backdrop-blur-sm hover:brightness-110",
        "glass-dark": "glass-dark text-white shadow-md hover:brightness-110",
        gradient:
          "hover:-translate-y-0.5 before:-z-10 relative overflow-hidden bg-primary text-white shadow-md transition-all duration-300 before:absolute before:inset-0 before:bg-linear-to-r before:from-blue-accent before:to-secondary-100 before:opacity-0 before:transition-opacity hover:shadow-lg hover:before:opacity-100",
        glow: "hover:-translate-y-0.5 bg-primary-80 text-white shadow-glow transition-all duration-300 hover:shadow-glow-blue",
        "golden-gradient":
          "hover:-translate-y-0.5 relative bg-linear-to-r from-gold-default to-gold-accent text-primary-100 shadow-card-gold transition-all duration-300 hover:shadow-xl",
        animated:
          "relative overflow-hidden bg-primary-90 text-white transition-colors duration-300 hover:bg-primary-80",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        xl: "h-12 rounded-lg px-10 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = ({
  className,
  variant,
  size,
  asChild = false,
  ref,
  ...props
}: ButtonProps & { ref?: React.RefObject<HTMLButtonElement | null> }) => {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  );
};
Button.displayName = "Button";

export { Button, buttonVariants };
