"use client";

import { Content, List, Root, Trigger } from "@radix-ui/react-tabs";
import { cn } from "@repo/ui/lib/utils";
import type * as React from "react";

const Tabs = Root;

const TabsList = ({
  className,
  ref,
  ...props
}: React.ComponentPropsWithoutRef<typeof List> & {
  ref?: React.RefObject<React.ElementRef<typeof List> | null>;
}) => (
  <List
    className={cn(
      "inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground",
      className
    )}
    ref={ref}
    {...props}
  />
);
TabsList.displayName = List.displayName;

const TabsTrigger = ({
  className,
  ref,
  ...props
}: React.ComponentPropsWithoutRef<typeof Trigger> & {
  ref?: React.RefObject<React.ElementRef<typeof Trigger> | null>;
}) => (
  <Trigger
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 font-medium text-sm ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow",
      className
    )}
    ref={ref}
    {...props}
  />
);
TabsTrigger.displayName = Trigger.displayName;

const TabsContent = ({
  className,
  ref,
  ...props
}: React.ComponentPropsWithoutRef<typeof Content> & {
  ref?: React.RefObject<React.ElementRef<typeof Content> | null>;
}) => (
  <Content
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    ref={ref}
    {...props}
  />
);
TabsContent.displayName = Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
