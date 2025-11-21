"use client";

import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "@repo/ui/lib/utils";
import type * as React from "react";

const Progress = ({
  className,
  value,
  ref,
  ...props
}: React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & {
  ref?: React.RefObject<React.ElementRef<typeof ProgressPrimitive.Root> | null>;
}) => (
  <ProgressPrimitive.Root
    className={cn(
      "relative h-2 w-full overflow-hidden rounded-full bg-linear-to-r from-gray-100 to-gray-50",
      className
    )}
    ref={ref}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className="h-full w-full flex-1 bg-linear-to-r from-blue-600 to-blue-400 transition-all duration-500 ease-in-out"
      style={{
        transform: `translateX(-${100 - (value || 0)}%)`,
      }}
    >
      <div className="absolute inset-0 opacity-50">
        <div className="h-full w-full animate-shimmer bg-linear-to-r from-transparent via-white/25 to-transparent" />
      </div>
    </ProgressPrimitive.Indicator>
  </ProgressPrimitive.Root>
);
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
