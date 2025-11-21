"use client";

import { Slot } from "@radix-ui/react-slot";
import { cn } from "@repo/ui/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/92",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-border bg-transparent text-foreground hover:bg-muted/40",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/90",
        ghost: "text-foreground hover:bg-muted/30",
        link: "underline-offset-4 hover:underline text-accent",
        glass:
          "glass text-foreground hover:brightness-110 backdrop-blur-sm border border-white/10 shadow-md",
        "glass-dark": "glass-dark text-white hover:brightness-110 shadow-md",
        gradient:
          "relative overflow-hidden bg-primary text-white shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 before:absolute before:inset-0 before:bg-linear-to-r before:from-blue-accent before:to-secondary-100 before:opacity-0 before:transition-opacity hover:before:opacity-100 before:-z-10",
        glow: "bg-primary-80 text-white shadow-glow hover:shadow-glow-blue transition-all duration-300 hover:-translate-y-0.5",
        "golden-gradient":
          "relative text-primary-100 bg-linear-to-r from-gold-default to-gold-accent shadow-card-gold hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300",
        animated:
          "bg-primary-90 text-white hover:bg-primary-80 transition-colors duration-300 relative overflow-hidden",
      },
      size: {
        default: "h-10 py-2 px-4",
        sm: "h-9 px-3 rounded-md",
        lg: "h-11 px-8 rounded-md",
        xl: "h-12 px-10 rounded-lg text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
