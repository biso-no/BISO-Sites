"use client"
import { TooltipProvider } from "@repo/ui/components/ui/tooltip"
import { ThemeProvider } from "@repo/ui/components/theme-provider"

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
      <ThemeProvider defaultTheme="light" enableSystem={true}>
          <TooltipProvider>
            {children}
          </TooltipProvider>
      </ThemeProvider>
  )
}
