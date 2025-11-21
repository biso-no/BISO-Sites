"use client";

import { cn } from "@repo/ui/lib/utils";
import type * as React from "react";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = ({
  className,
  type,
  ref,
  ...props
}: InputProps & { ref?: React.Ref<HTMLInputElement> }) => (
  <input
    className={cn(
      "flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm",
      "transition-colors duration-200",
      "placeholder:text-muted-foreground/60",
      "hover:border-secondary-100/30",
      "focus:border-secondary-100/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-secondary-100/30",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "file:border-0 file:bg-transparent file:font-medium file:text-sm",
      className
    )}
    ref={ref}
    type={type}
    {...props}
  />
);
Input.displayName = "Input";

export { Input };
