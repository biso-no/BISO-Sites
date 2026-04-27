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
    fontFamily: "var(--font-inter), ui-sans-serif, system-ui",
    theme: "base",
    themeVariables: {
      /* BISO brand palette: blue #3DA9E0, navy #001731, yellow #F7D64A */
      primaryColor: resolvedTheme === "dark" ? "#1a3a5c" : "#dbeeff",
      primaryTextColor: resolvedTheme === "dark" ? "#e0f2fe" : "#001731",
      primaryBorderColor: resolvedTheme === "dark" ? "#3DA9E0" : "#3DA9E0",
      lineColor: resolvedTheme === "dark" ? "#3DA9E0" : "#0077b6",
      secondaryColor: resolvedTheme === "dark" ? "#0d2235" : "#f0f9ff",
      tertiaryColor: resolvedTheme === "dark" ? "#001731" : "#ffffff",
      mainBkg: resolvedTheme === "dark" ? "#0d2235" : "#ffffff",
      nodeBorder: resolvedTheme === "dark" ? "#3DA9E0" : "#93c5fd",
      clusterBkg:
        resolvedTheme === "dark"
          ? "rgba(0, 23, 49, 0.6)"
          : "rgba(219, 238, 255, 0.5)",
      clusterBorder: resolvedTheme === "dark" ? "#3DA9E0" : "#93c5fd",
      titleColor: resolvedTheme === "dark" ? "#7dd3fc" : "#0077b6",
      edgeLabelBackground: resolvedTheme === "dark" ? "#001731" : "#f0f9ff",
      /* Accent nodes use BISO yellow */
      tertiaryTextColor: resolvedTheme === "dark" ? "#F7D64A" : "#92620d",
      tertiaryBorderColor: resolvedTheme === "dark" ? "#F7D64A" : "#f7d64a",
    },
  });

  const { svg, bindFunctions } = use(
    cachePromise(`${chart}-${resolvedTheme}`, () => {
      return mermaid.render(id, chart.replaceAll("\\n", "\n"));
    })
  );

  return (
    <div
      // biome-ignore lint/security/noDangerouslySetInnerHtml: Mermaid returns SVG for trusted docs content.
      dangerouslySetInnerHTML={{ __html: svg }}
      ref={(container) => {
        if (container) {
          bindFunctions?.(container);
        }
      }}
    />
  );
}
