"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { User } from "@/lib/types/user"

interface UserAvatarProps {
  user: User
  className?: string
  size?: "sm" | "md" | "lg"
}

export function UserAvatar({ user, className, size = "md" }: UserAvatarProps) {
  // Generate initials from name
  const initials = user.name
    .split(" ")
    .map(part => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
  
  // Determine avatar background color based on user name (consistent for each user)
  const nameHash = user.name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const colors = [
    "bg-red-500",
    "bg-orange-500",
    "bg-amber-500",
    "bg-yellow-500",
    "bg-lime-500",
    "bg-green-500",
    "bg-emerald-500",
    "bg-teal-500",
    "bg-cyan-500",
    "bg-sky-500",
    "bg-blue-500",
    "bg-indigo-500",
    "bg-violet-500",
    "bg-purple-500",
    "bg-fuchsia-500",
    "bg-pink-500",
    "bg-rose-500",
  ]
  const bgColor = colors[nameHash % colors.length]
  
  // Determine size class
  const sizeClass = {
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-16 w-16 text-lg",
  }[size]
  
  return (
    <Avatar className={cn(sizeClass, className)}>
      <AvatarImage src={user.avatarUrl} alt={user.name} />
      <AvatarFallback className={cn("font-medium text-white", bgColor)}>
        {initials}
      </AvatarFallback>
    </Avatar>
  )
} 