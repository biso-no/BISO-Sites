"use client"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type RoleColors = {
  [key: string]: {
    bg: string
    text: string
    border?: string
  }
}

const ROLE_COLORS: RoleColors = {
  User: {
    bg: "bg-blue-100",
    text: "text-blue-800",
    border: "border-blue-200"
  },
  HR: {
    bg: "bg-purple-100",
    text: "text-purple-800",
    border: "border-purple-200"
  },
  PR: {
    bg: "bg-pink-100",
    text: "text-pink-800",
    border: "border-pink-200"
  },
  KK: {
    bg: "bg-yellow-100",
    text: "text-yellow-800",
    border: "border-yellow-200"
  },
  Finance: {
    bg: "bg-green-100",
    text: "text-green-800",
    border: "border-green-200"
  },
  Admin: {
    bg: "bg-red-100",
    text: "text-red-800",
    border: "border-red-200"
  },
  default: {
    bg: "bg-gray-100",
    text: "text-gray-800",
    border: "border-gray-200"
  }
}

interface RoleBadgeProps {
  role: string
  className?: string
}

export function RoleBadge({ role, className }: RoleBadgeProps) {
  const colors = ROLE_COLORS[role] || ROLE_COLORS.default
  
  return (
    <Badge 
      variant="outline"
      className={cn(
        "rounded-md font-medium border",
        colors.bg,
        colors.text,
        colors.border,
        className
      )}
    >
      {role}
    </Badge>
  )
}

interface RoleBadgeListProps {
  roles: string[]
  limit?: number
  className?: string
}

export function RoleBadgeList({ roles, limit = 3, className }: RoleBadgeListProps) {
  const displayRoles = roles.slice(0, limit)
  const extraCount = roles.length - limit
  
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {displayRoles.map((role) => (
        <RoleBadge key={role} role={role} />
      ))}
      
      {extraCount > 0 && (
        <Badge 
          variant="outline" 
          className="rounded-md font-medium border bg-gray-100 text-gray-800 border-gray-200"
        >
          +{extraCount} more
        </Badge>
      )}
    </div>
  )
} 