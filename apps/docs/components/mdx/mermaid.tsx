"use client";

import { useTheme } from "next-themes";
import { type CSSProperties, use, useEffect, useId, useState } from "react";

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

  return <MermaidFrame bindFunctions={bindFunctions} svg={svg} />;
}

/**
 * A diagram never shrinks below this share of its natural size, which keeps
 * Mermaid's 16 px labels at 12 px or more.
 */
export const MIN_SCALE = 0.75;

/** The width of the root `<svg>`'s viewBox, ignoring any nested viewBox. */
const ROOT_VIEWBOX_WIDTH =
  /^\s*<svg\b[^>]*?\sviewBox="\s*-?[\d.]+[\s,]+-?[\d.]+[\s,]+([\d.]+)/;

/** A diagram's natural width in px, read from its viewBox. */
export function naturalWidth(svg: string): number | null {
  const match = ROOT_VIEWBOX_WIDTH.exec(svg);
  const width = match ? Number.parseFloat(match[1]) : Number.NaN;
  return Number.isFinite(width) && width > 0 ? width : null;
}

/**
 * Mermaid sizes the SVG to `width="100%"` with its natural width as
 * `max-width`. The frame adds a `min-width` of `MIN_SCALE` times that width,
 * at every screen size. A diagram that still doesn't fit scrolls sideways
 * inside the frame, and the frame's inline-size containment keeps the page
 * itself from widening.
 */
export function MermaidFrame({
  svg,
  bindFunctions,
}: {
  svg: string;
  bindFunctions?: (element: Element) => void;
}) {
  const width = naturalWidth(svg);
  const style = width
    ? ({
        "--mermaid-min-width": `${Math.round(width * MIN_SCALE)}px`,
      } as CSSProperties)
    : undefined;

  return (
    <div
      className="overflow-x-auto overscroll-x-contain contain-inline-size [&>svg]:min-w-(--mermaid-min-width)"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: Mermaid returns SVG for trusted docs content.
      dangerouslySetInnerHTML={{ __html: svg }}
      ref={(container) => {
        if (container) {
          bindFunctions?.(container);
        }
      }}
      style={style}
    />
  );
}
