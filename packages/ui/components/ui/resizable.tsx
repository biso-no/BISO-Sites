"use client";

import * as React from "react";
import {
  PanelGroup as ResizablePanelGroupPrimitive,
  Panel as ResizablePanelPrimitive,
  PanelResizeHandle as ResizableHandlePrimitive,
} from "react-resizable-panels";
import { cn } from "@/lib/utils";

type PanelGroupProps = React.ComponentProps<typeof ResizablePanelGroupPrimitive>;
type PanelProps = React.ComponentProps<typeof ResizablePanelPrimitive>;
type HandleProps = React.HTMLAttributes<HTMLDivElement>;

export function ResizablePanelGroup({ className, ...props }: PanelGroupProps) {
  return (
    <ResizablePanelGroupPrimitive
      className={cn("flex h-full w-full", className)}
      {...props}
    />
  );
}

export function ResizablePanel({ className, ...props }: PanelProps) {
  return (
    <ResizablePanelPrimitive className={cn("h-full w-full", className)} {...props} />
  );
}

export function ResizableHandle({ className, ...props }: HandleProps) {
  return (
    <ResizableHandlePrimitive
      className={cn(
        "group relative flex w-2 items-center justify-center",
        "after:absolute after:inset-y-0 after:left-0 after:w-0.5 after:bg-border after:opacity-60",
        "hover:after:bg-primary/60",
        className,
      )}
      {...(props as any)}
    />
  );
}


