"use client"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface UserStatusProps {
  isActive: boolean
  compact?: boolean
}

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
                  "animate-pulse absolute inline-flex h-full w-full rounded-full opacity-75",
                  isActive ? "bg-green-500" : "bg-gray-500"
                )}
              />
              <span 
                className={cn(
                  "relative inline-flex rounded-full h-full w-full",
                  isActive ? "bg-green-500" : "bg-gray-500"
                )}
              />
            </span>
            {!compact && (
              <Badge 
                variant={isActive ? "default" : "secondary"}
                className={cn(
                  "font-medium",
                  isActive ? "bg-green-100 text-green-800 hover:bg-green-100" : "bg-gray-100 text-gray-800 hover:bg-gray-100"
                )}
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
  )
} 