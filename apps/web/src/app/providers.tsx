"use client"
import { AuthProvider } from "../lib/hooks/useAuth"
import { TooltipProvider } from "@repo/ui/components/ui/tooltip"
import { ToastProvider } from "@repo/ui/components/ui/use-toast"

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>
        <TooltipProvider>
        {children}
        </TooltipProvider>
        </ToastProvider>
    </AuthProvider>
  )
}
