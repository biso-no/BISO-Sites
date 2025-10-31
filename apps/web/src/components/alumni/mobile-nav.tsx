"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { X } from "lucide-react"
import { Button } from "@repo/ui/components/ui/button"
import { ScrollArea } from "@repo/ui/components/ui/scroll-area"
import { Sheet, SheetContent } from "@repo/ui/components/ui/sheet"
import { cn } from '@repo/ui/lib/utils'

interface MobileNavProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MobileNav({ open, onOpenChange }: MobileNavProps) {
  const pathname = usePathname()
  
  const routes = [
    {
      href: "/alumni",
      label: "Dashboard",
      active: pathname === "/alumni",
    },
    {
      href: "/alumni/network",
      label: "Network",
      active: pathname === "/alumni/network",
    },
    {
      href: "/alumni/events",
      label: "Events",
      active: pathname.includes("/alumni/events"),
    },
    {
      href: "/alumni/mentoring",
      label: "Mentoring",
      active: pathname.includes("/alumni/mentoring"),
    },
    {
      href: "/alumni/jobs",
      label: "Job Board",
      active: pathname.includes("/alumni/jobs"),
    },
    {
      href: "/alumni/resources",
      label: "Resources",
      active: pathname.includes("/alumni/resources"),
    },
    {
      href: "/alumni/profile",
      label: "My Profile",
      active: pathname === "/alumni/profile",
    },
  ]
  
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-full xs:w-80 sm:max-w-md pr-0">
        <div className="px-2">
          <div className="flex items-center justify-between">
            <Link
              href="/alumni"
              className="flex items-center"
              onClick={() => onOpenChange(false)}
            >
              <span className="font-heading text-xl font-bold bg-linear-to-r from-white to-gray-400 bg-clip-text text-transparent">
                BISO Alumni
              </span>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-5 w-5" />
              <span className="sr-only">Close menu</span>
            </Button>
          </div>
        </div>
        <ScrollArea className="my-4 h-[calc(100vh-8rem)] pb-10 pl-6">
          <div className="flex flex-col gap-2 pl-1 pr-7">
            {routes.map((route) => (
              <Link
                key={route.href}
                href={route.href}
                onClick={() => onOpenChange(false)}
                className={cn(
                  "flex items-center gap-2 text-lg font-medium py-2 px-3 rounded-md transition-colors hover:text-primary",
                  route.active
                    ? "bg-secondary text-primary"
                    : "text-muted-foreground"
                )}
              >
                {route.label}
              </Link>
            ))}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
} 