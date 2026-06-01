"use client";

import { ArrowRight } from "lucide-react";
import { MONO_STACK, STUDIO } from "../../studio";

interface NavigationChipProps {
  path: string;
  reason?: string;
}

export function NavigationChip({ path, reason }: NavigationChipProps) {
  return (
    <div
      className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs"
      style={{
        background: "rgba(42,74,122,0.07)",
        borderColor: "rgba(42,74,122,0.18)",
        color: STUDIO.sky,
        fontFamily: MONO_STACK,
      }}
    >
      <ArrowRight size={11} />
      <span>{reason ?? `Navigating to ${path}`}</span>
    </div>
  );
}
