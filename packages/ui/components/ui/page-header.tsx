"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  heading: string
  subheading?: string
  gradient?: boolean
  golden?: boolean
  actions?: React.ReactNode
}

export function PageHeader({
  heading,
  subheading,
  gradient = false,
  golden = false,
  className,
  actions,
  ...props
}: PageHeaderProps) {
  return (
    <div className={cn("grid gap-1 pb-8", className)} {...props}>
      <div className="flex items-center justify-between gap-4">
        <h1 
          className={cn(
            "text-3xl font-bold tracking-tight md:text-4xl",
            gradient && "gradient-text",
            golden && "gradient-text-gold",
          )}
        >
          {heading}
        </h1>
        {actions && (
          <div className="flex items-center gap-2">
            {actions}
          </div>
        )}
      </div>
      {subheading && (
        <p className="text-muted-foreground md:text-lg">{subheading}</p>
      )}
    </div>
  )
}

