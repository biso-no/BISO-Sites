"use client";
import { ThemeProvider } from "@repo/ui/components/theme-provider";
import { TooltipProvider } from "@repo/ui/components/ui/tooltip";
import { MotionConfig } from "motion/react";
import { Toaster } from "sonner";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    // `reducedMotion="user"` makes every `motion` component in the app honour
    // the OS setting. This is the only lever that reaches them: motion animates
    // through WAAPI and inline styles, not CSS transitions, so the
    // `prefers-reduced-motion` block in styles.css cannot stop it. Phase 0
    // counted 161 fade-and-slide-ups and 115 scroll reveals across 99 files
    // with no reduced-motion handling anywhere — one provider fixes all of them
    // without editing any.
    //
    // Transforms and opacity are skipped for those users; layout and colour
    // changes still animate, which is the behaviour the spec asks for.
    <MotionConfig reducedMotion="user">
      <ThemeProvider>
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster closeButton position="top-center" richColors />
      </ThemeProvider>
    </MotionConfig>
  );
}
