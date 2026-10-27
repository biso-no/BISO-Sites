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

/**
 * Diagram colours from the BISO palette. On paper, lines and borders are the
 * action blue (sky is for navy only); on navy, they are sky. Sun is a marker,
 * so it only ever draws a border, never text.
 */
const MERMAID_THEME = {
  light: {
    primaryColor: "#eef1f5",
    primaryTextColor: "#001a35",
    primaryBorderColor: "#1668ae",
    lineColor: "#1668ae",
    secondaryColor: "#f7f9fb",
    tertiaryColor: "#ffffff",
    mainBkg: "#ffffff",
    nodeBorder: "#1668ae",
    clusterBkg: "#f7f9fb",
    clusterBorder: "#e8ecf0",
    titleColor: "#001a35",
    edgeLabelBackground: "#ffffff",
    tertiaryTextColor: "#001a35",
    tertiaryBorderColor: "#fecd45",
  },
  dark: {
    primaryColor: "#0b2747",
    primaryTextColor: "#ffffff",
    primaryBorderColor: "#3aa3e1",
    lineColor: "#3aa3e1",
    secondaryColor: "#001a35",
    tertiaryColor: "#00142a",
    mainBkg: "#0b2747",
    nodeBorder: "#3aa3e1",
    clusterBkg: "#001a35",
    clusterBorder: "#12314f",
    titleColor: "#ffffff",
    edgeLabelBackground: "#00142a",
    tertiaryTextColor: "#93a7bb",
    tertiaryBorderColor: "#fecd45",
  },
} as const;

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
    fontFamily: "var(--font-museo), ui-sans-serif, system-ui",
    theme: "base",
    themeVariables:
      resolvedTheme === "dark" ? MERMAID_THEME.dark : MERMAID_THEME.light,
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
