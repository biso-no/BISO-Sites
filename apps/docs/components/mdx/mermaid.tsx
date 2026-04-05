"use client";

import { useTheme } from "next-themes";
import { use, useEffect, useId, useState } from "react";

export function Mermaid({ chart }: { chart: string }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return;
  }
  return <MermaidContent chart={chart} />;
}

const cache = new Map<string, Promise<unknown>>();

function cachePromise<T>(
  key: string,
  setPromise: () => Promise<T>
): Promise<T> {
  const cached = cache.get(key);
  if (cached) {
    return cached as Promise<T>;
  }

  const promise = setPromise();
  cache.set(key, promise);
  return promise;
}

function MermaidContent({ chart }: { chart: string }) {
  const id = useId();
  const { resolvedTheme } = useTheme();
  const { default: mermaid } = use(
    cachePromise("mermaid", () => import("mermaid"))
  );

  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "loose",
    fontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui",
    theme: "base",
    themeVariables: {
      primaryColor: resolvedTheme === "dark" ? "#3b82f6" : "#2563eb",
      primaryTextColor: resolvedTheme === "dark" ? "#fff" : "#000",
      primaryBorderColor: resolvedTheme === "dark" ? "#3b82f6" : "#2563eb",
      lineColor: resolvedTheme === "dark" ? "#6366f1" : "#4f46e5",
      secondaryColor: resolvedTheme === "dark" ? "#1e293b" : "#f1f5f9",
      tertiaryColor: resolvedTheme === "dark" ? "#0f172a" : "#ffffff",
      mainBkg: resolvedTheme === "dark" ? "#1e293b" : "#ffffff",
      nodeBorder: resolvedTheme === "dark" ? "#334155" : "#e2e8f0",
      clusterBkg:
        resolvedTheme === "dark"
          ? "rgba(30, 41, 59, 0.5)"
          : "rgba(241, 245, 249, 0.5)",
      clusterBorder: resolvedTheme === "dark" ? "#475569" : "#cbd5e1",
      titleColor: resolvedTheme === "dark" ? "#94a3b8" : "#64748b",
      edgeLabelBackground: resolvedTheme === "dark" ? "#0f172a" : "#ffffff",
    },
  });

  const { svg, bindFunctions } = use(
    cachePromise(`${chart}-${resolvedTheme}`, () => {
      return mermaid.render(id, chart.replaceAll("\\n", "\n"));
    })
  );

  return (
    <div
      dangerouslySetInnerHTML={{ __html: svg }}
      ref={(container) => {
        if (container) {
          bindFunctions?.(container);
        }
      }}
    />
  );
}
