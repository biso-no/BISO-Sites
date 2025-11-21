"use client";

import { cn } from "@repo/ui/lib/utils";
import type * as React from "react";
import {
  PanelResizeHandle as ResizableHandlePrimitive,
  PanelGroup as ResizablePanelGroupPrimitive,
  Panel as ResizablePanelPrimitive,
} from "react-resizable-panels";

type PanelGroupProps = React.ComponentProps<
  typeof ResizablePanelGroupPrimitive
>;
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
    <ResizablePanelPrimitive
      className={cn("h-full w-full", className)}
      {...props}
    />
  );
}

export function ResizableHandle({ className, ...props }: HandleProps) {
  return (
    <ResizableHandlePrimitive
      className={cn(
        "group relative flex w-2 items-center justify-center",
        "after:absolute after:inset-y-0 after:left-0 after:w-0.5 after:bg-border after:opacity-60",
        "hover:after:bg-primary/60",
        className
      )}
      {...(props as any)}
    />
  );
}
