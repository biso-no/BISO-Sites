"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { 
  LayoutDashboard, 
  Users, 
  Calendar, 
  BookOpen, 
  Briefcase, 
  Library,
  FileText,
  MessageSquare,
  Settings,
  ShieldCheck
} from "lucide-react"
import { cn } from '@repo/ui/lib/utils'
import { ScrollArea } from "@repo/ui/components/ui/scroll-area"
import { Button } from "@repo/ui/components/ui/button"
import { Separator } from "@repo/ui/components/ui/separator"
import { useEffect, useState } from "react"

// Client-side feature flag states
interface FeatureFlags {
  network: boolean;
  events: boolean;
  mentoring: boolean;
  jobs: boolean;
  resources: boolean;
  messages: boolean;
  admin: boolean;
}

export function AlumniSidebar({ featureFlags }: { featureFlags: FeatureFlags }) {
  const pathname = usePathname()
  const router = useRouter()
  
  // Generate a unique key based on the feature flags to force re-renders when they change
  const flagsKey = Object.entries(featureFlags)
    .map(([key, value]) => `${key}:${value ? '1' : '0'}`)
    .join('|')
  
  // Force re-render when path changes to ensure we get fresh props
  useEffect(() => {
    // This will cause the component to re-render on navigation
    const handleRouteChange = () => {
      // This is intentionally empty - the effect dependency on pathname
      // will cause featureFlags to be refreshed when props change
    }
    
    handleRouteChange()
    // Re-run this effect when the path changes
  }, [pathname])
  
  const mainRoutes = [
    {
      href: "/alumni",
      label: "Dashboard",
      icon: LayoutDashboard,
      active: pathname === "/alumni",
      color: "text-blue-accent",
      enabled: true // Always enabled
    },
    {
      href: "/alumni/network",
      label: "Network",
      icon: Users,
      active: pathname === "/alumni/network",
      color: "text-secondary-100",
      enabled: featureFlags.network
    },
    {
      href: "/alumni/events",
      label: "Events",
      icon: Calendar,
      active: pathname.includes("/alumni/events"),
      color: "text-gold-default",
      enabled: featureFlags.events
    },
    {
      href: "/alumni/mentoring",
      label: "Mentoring",
      icon: BookOpen,
      active: pathname.includes("/alumni/mentoring"),
      color: "text-gold-strong",
      enabled: featureFlags.mentoring
    },
    {
      href: "/alumni/jobs",
      label: "Job Board",
      icon: Briefcase,
      active: pathname.includes("/alumni/jobs"),
      color: "text-blue-accent",
      enabled: featureFlags.jobs
    },
    {
      href: "/alumni/resources",
      label: "Resources",
      icon: Library,
      active: pathname.includes("/alumni/resources"),
      color: "text-secondary-100",
      enabled: featureFlags.resources
    }
  ]
  
  const otherRoutes = [
    {
      href: "/alumni/profile",
      label: "My Profile",
      icon: FileText,
      active: pathname === "/alumni/profile",
      color: "text-blue-accent",
      enabled: true // Always enabled
    },
    {
      href: "/alumni/messages",
      label: "Messages",
      icon: MessageSquare,
      active: pathname === "/alumni/messages",
      color: "text-secondary-100",
      enabled: featureFlags.messages
    },
    {
      href: "/alumni/settings",
      label: "Settings",
      icon: Settings,
      active: pathname === "/alumni/settings",
      color: "text-gold-default",
      enabled: true // Always enabled
    },
    {
      href: "/alumni/admin",
      label: "Admin Dashboard",
      icon: ShieldCheck,
      active: pathname.includes("/alumni/admin"),
      color: "text-purple-500",
      enabled: featureFlags.admin
    }
  ]
  
  return (
    <aside className="hidden md:flex h-full w-64 flex-col border-r border-secondary-100/10 bg-primary-90/60 backdrop-blur-md pt-16">
      <ScrollArea className="flex-1 py-6">
        <div className="px-3 py-2">
          <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight text-white">
            Main
          </h2>
          <div className="space-y-1">
            {mainRoutes.filter(route => route.enabled).map((route) => (
              <Button
                key={`${route.href}-${flagsKey}`}
                asChild
                variant={route.active ? "glass-dark" : "ghost"}
                size="sm"
                className={cn(
                  "w-full justify-start",
                  route.active ? 
                    "bg-primary-80/80 text-white border border-secondary-100/20" : 
                    "text-gray-300 hover:text-white hover:bg-primary-80/40"
                )}
              >
                <Link href={route.href} className="flex items-center">
                  <route.icon className={cn("mr-2 h-4 w-4", route.active ? route.color : "text-gray-300")} />
                  <span>{route.label}</span>
                  {route.active && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-linear-to-r from-blue-accent to-secondary-100" />
                  )}
                </Link>
              </Button>
            ))}
          </div>
        </div>
        <Separator className="my-4 bg-secondary-100/10" />
        <div className="px-3 py-2">
          <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight text-white">
            Personal
          </h2>
          <div className="space-y-1">
            {otherRoutes.filter(route => route.enabled).map((route) => (
              <Button
                key={`${route.href}-${flagsKey}`}
                asChild
                variant={route.active ? "glass-dark" : "ghost"}
                size="sm"
                className={cn(
                  "w-full justify-start",
                  route.active ? 
                    "bg-primary-80/80 text-white border border-secondary-100/20" : 
                    "text-gray-300 hover:text-white hover:bg-primary-80/40"
                )}
              >
                <Link href={route.href} className="flex items-center">
                  <route.icon className={cn("mr-2 h-4 w-4", route.active ? route.color : "text-gray-300")} />
                  <span>{route.label}</span>
                  {route.active && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-linear-to-r from-blue-accent to-secondary-100" />
                  )}
                </Link>
              </Button>
            ))}
          </div>
        </div>
      </ScrollArea>
    </aside>
  )
} 