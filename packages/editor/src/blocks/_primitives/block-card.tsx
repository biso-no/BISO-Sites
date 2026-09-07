"use client";

import { Card } from "@repo/ui/components/ui/card";
import { cn } from "@repo/ui/lib/utils";
import type { ReactNode } from "react";

export const BlockCard = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => <Card className={cn("h-full p-6", className)}>{children}</Card>;
