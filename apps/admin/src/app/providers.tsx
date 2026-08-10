"use client";
import { ThemeProvider } from "@repo/ui/components/theme-provider";
import { TooltipProvider } from "@repo/ui/components/ui/tooltip";
import { Toaster } from "sonner";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider defaultTheme="light" enableSystem={false}>
      <TooltipProvider>
        {children}
        <Toaster closeButton position="top-right" richColors />
      </TooltipProvider>
    </ThemeProvider>
  );
}
