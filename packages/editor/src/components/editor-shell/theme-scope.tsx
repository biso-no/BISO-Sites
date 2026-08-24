"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { useEditorStore } from "@/editor/store";

interface Props {
  /** Initial accent hex — overridden by doc.meta.accentColor on mount. */
  accent?: string;
  children: ReactNode;
}

export function ThemeScope({ children, accent }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const accentColor = useEditorStore((s) => s.doc.meta.accentColor);

  useEffect(() => {
    if (ref.current) {
      ref.current.style.setProperty(
        "--page-accent",
        accentColor || accent || "#3DA9E0"
      );
    }
  }, [accentColor, accent]);

  return (
    <div ref={ref} style={{ display: "contents" }}>
      {children}
    </div>
  );
}
