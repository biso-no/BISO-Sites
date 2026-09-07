"use client";

import { Slot } from "@radix-ui/react-slot";
import { cn } from "@repo/ui/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

const buttonVariants = cva(
  // RD-031: an outline, not a ring. The ring is composed into `box-shadow`, so
  // every variant that also sets a shadow (`gradient`, and any caller passing
  // `shadow-*`) silently swallowed it — measured on /projects, where the
  // primary CTA had no focus indicator at all while its `outline` sibling did.
  // An outline cannot be swallowed, and since RD-030 removed the universal
  // `outline-ring/50` it takes the colour it asks for.
  "inline-flex items-center justify-center rounded-md font-medium text-sm transition-colors focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-solid focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50",
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
        // RD-030: `glass`, `glass-dark`, `glow`, `golden-gradient` and
        // `animated` are gone. Each named colours registered nowhere
        // (`primary-80`, `primary-90`, `gold-default`, `gold-accent`) or
        // shadows that do not exist (`shadow-glow`, `shadow-card-gold`), so
        // Tailwind emitted nothing and they rendered as unstyled buttons — and
        // none had a call site anywhere. `00-current-state.md` §3.4.
        //
        // `gradient` stays because three call sites use it, but its gradient
        // does not: `before:from-blue-accent before:to-secondary-100` names two
        // more unregistered colours, so the `::before` overlay it fades in on
        // hover has always been transparent. The dead half is removed and the
        // half that does render — a primary button that lifts — is kept
        // verbatim, so those three buttons look exactly as they do today.
        gradient:
          "hover:-translate-y-0.5 relative bg-primary text-white shadow-md transition-all duration-300 hover:shadow-lg",
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
