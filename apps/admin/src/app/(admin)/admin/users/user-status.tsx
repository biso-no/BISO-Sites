"use client";

import { Badge } from "@repo/ui/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/components/ui/tooltip";
import { cn } from "@/lib/utils";

type UserStatusProps = {
  isActive: boolean;
  compact?: boolean;
};

export function UserStatus({ isActive, compact = false }: UserStatusProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "relative flex h-3 w-3 rounded-full",
                compact ? "h-2 w-2" : "h-3 w-3"
              )}
            >
              <span
                className={cn(
                  "absolute inline-flex h-full w-full animate-pulse rounded-full opacity-75",
                  isActive ? "bg-green-500" : "bg-gray-500"
                )}
              />
              <span
                className={cn(
                  "relative inline-flex h-full w-full rounded-full",
                  isActive ? "bg-green-500" : "bg-gray-500"
                )}
              />
            </span>
            {!compact && (
              <Badge
                className={cn(
                  "font-medium",
                  isActive
                    ? "bg-green-100 text-green-800 hover:bg-green-100"
                    : "bg-gray-100 text-gray-800 hover:bg-gray-100"
                )}
                variant={isActive ? "default" : "secondary"}
              >
                {isActive ? "Active" : "Inactive"}
              </Badge>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="right">
          <p>User is {isActive ? "active" : "inactive"}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
