"use client";

import { Content, Provider, Root, Trigger } from "@radix-ui/react-tooltip";
import { cn } from "@repo/ui/lib/utils";
import type * as React from "react";

const TooltipProvider = Provider;

const Tooltip = Root;

const TooltipTrigger = Trigger;

const TooltipContent = ({
  className,
  sideOffset = 4,
  ref,
  ...props
}: React.ComponentPropsWithoutRef<typeof Content> & {
  ref?: React.RefObject<React.ElementRef<typeof Content> | null>;
}) => (
  <Content
    className={cn(
      "fade-in-0 zoom-in-95 data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 animate-in overflow-hidden rounded-md bg-primary px-3 py-1.5 text-primary-foreground text-xs data-[state=closed]:animate-out",
      className
    )}
    ref={ref}
    sideOffset={sideOffset}
    {...props}
  />
);
TooltipContent.displayName = Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
