"use client"
import { AuthProvider } from "../lib/hooks/useAuth"
import { TooltipProvider } from "@repo/ui/components/ui/tooltip"
import { ToastProvider } from "@repo/ui/components/ui/use-toast"
import { ThemeProvider } from "@repo/ui/components/theme-provider"

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ThemeProvider>
        <ToastProvider>
          <TooltipProvider>
            {children}
          </TooltipProvider>
        </ToastProvider>
      </ThemeProvider>
    </AuthProvider>
  )
}
