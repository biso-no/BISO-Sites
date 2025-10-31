"use client"

import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"
import { cn } from "@/lib/utils"

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "group peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent",
      "transition-all duration-300 ease-in-out",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "data-[state=checked]:bg-linear-to-r data-[state=checked]:from-primary data-[state=checked]:to-primary/80",
      "data-[state=unchecked]:bg-linear-to-r data-[state=unchecked]:from-gray-200 data-[state=unchecked]:to-gray-300",
      "hover:data-[state=checked]:from-primary/90 hover:data-[state=checked]:to-primary/70",
      "hover:data-[state=unchecked]:from-gray-300 hover:data-[state=unchecked]:to-gray-200",
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-5 w-5 rounded-full shadow-lg ring-0 transition-all duration-300",
        "bg-linear-to-b from-white to-gray-50",
        "group-data-[state=checked]:translate-x-5 group-data-[state=unchecked]:translate-x-0",
        "group-hover:scale-[0.95]",
        "group-active:scale-[0.9]",
        "group-data-[state=checked]:group-hover:bg-white",
        "after:absolute after:inset-0 after:rounded-full after:shadow-inner"
      )}
    />
  </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }