"use client"
import { TooltipProvider } from "@repo/ui/components/ui/tooltip"
import { ThemeProvider } from "@repo/ui/components/theme-provider"

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
      <ThemeProvider>
          <TooltipProvider>
            {children}
          </TooltipProvider>
      </ThemeProvider>
  )
}
