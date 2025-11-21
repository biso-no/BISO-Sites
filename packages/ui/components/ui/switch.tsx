"use client";

import * as SwitchPrimitives from "@radix-ui/react-switch";
import { cn } from "@repo/ui/lib/utils";
import type * as React from "react";

const Switch = ({
  className,
  ref,
  ...props
}: React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root> & {
  ref?: React.RefObject<React.ElementRef<typeof SwitchPrimitives.Root> | null>;
}) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent",
      "transition-all duration-200 ease-in-out",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "shadow-inner",
      "hover:shadow-md",
      className
    )}
    style={{
      backgroundColor: props.checked
        ? "rgba(61, 169, 224, 1)" // Your brand blue (secondary-100)
        : "rgba(203, 213, 225, 1)", // Light gray (slate-300)
    }}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-5 w-5 rounded-full shadow-lg ring-0",
        "transition-all duration-200 ease-in-out",
        "bg-white"
      )}
      style={{
        transform: props.checked ? "translateX(20px)" : "translateX(0)",
        boxShadow: props.checked
          ? "0 2px 8px rgba(0, 23, 49, 0.2)"
          : "0 2px 4px rgba(0, 0, 0, 0.1)",
      }}
    />
  </SwitchPrimitives.Root>
);
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
