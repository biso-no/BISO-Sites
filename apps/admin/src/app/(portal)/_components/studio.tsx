import Link from "next/link";
import type {
  ButtonHTMLAttributes,
  ComponentType,
  CSSProperties,
  ReactNode,
} from "react";

export const STUDIO = {
  claret: "#6b1e1e",
  gold: "#b08a3e",
  ink: "#1a1814",
  ink2: "#3a342a",
  ink3: "#6b6357",
  ink4: "#9c9385",
  leaf: "#2f5d3a",
  paper: "#faf7f2",
  paper2: "#f3eee5",
  paper3: "#ede6d8",
  rule: "#e5dcca",
  rule2: "#d8cdb6",
  sky: "#2a4a7a",
  white: "#fffdf8",
} as const;

export const SERIF_STACK =
  '"Cormorant Garamond", "EB Garamond", "Times New Roman", Georgia, serif';

export const MONO_STACK =
  '"IBM Plex Mono", "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';

export const studioSurface: CSSProperties = {
  background: "rgba(255,255,255,0.46)",
  border: `0.5px solid ${STUDIO.rule}`,
  boxShadow: "0 1px 2px rgba(26,24,20,0.04)",
};

export const studioInsetSurface: CSSProperties = {
  background: STUDIO.paper2,
  border: `0.5px solid ${STUDIO.rule2}`,
};

export function StudioPageHeader({
  title,
  description,
  eyebrow,
  children,
}: {
  children?: ReactNode;
  description?: string;
  eyebrow?: ReactNode;
  title: ReactNode;
}) {
  return (
    <header
      className="mb-7 flex flex-col gap-5 border-b pb-6 lg:flex-row lg:items-end lg:justify-between"
      style={{ borderColor: STUDIO.rule }}
    >
      <div className="min-w-0">
        {eyebrow && (
          <div
            className="mb-3 flex items-center gap-2 font-medium text-[11px] uppercase tracking-[0.08em]"
            style={{ color: STUDIO.claret }}
          >
            {eyebrow}
          </div>
        )}
        <h1
          className="text-5xl leading-none md:text-6xl"
          style={{
            color: STUDIO.ink,
            fontFamily: SERIF_STACK,
            fontWeight: 400,
            letterSpacing: 0,
          }}
        >
          {title}
        </h1>
        {description && (
          <p
            className="mt-3 max-w-3xl text-sm leading-6"
            style={{ color: STUDIO.ink3 }}
          >
            {description}
          </p>
        )}
      </div>
      {children && (
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          {children}
        </div>
      )}
    </header>
  );
}

export function StudioPanel({
  children,
  className = "",
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <section
      className={`overflow-hidden rounded-2xl ${className}`}
      style={{ ...studioSurface, ...style }}
    >
      {children}
    </section>
  );
}

export function StudioCard({
  children,
  className = "",
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`rounded-2xl transition-colors ${className}`}
      style={{ ...studioSurface, ...style }}
    >
      {children}
    </div>
  );
}

export function StudioKpiStrip({
  children,
  columns = 4,
}: {
  children: ReactNode;
  columns?: 3 | 4;
}) {
  return (
    <section
      className={`grid overflow-hidden rounded-2xl ${
        columns === 3 ? "md:grid-cols-3" : "md:grid-cols-4"
      }`}
      style={studioSurface}
    >
      {children}
    </section>
  );
}

export function StudioKpi({
  alert,
  helper,
  icon,
  label,
  value,
}: {
  alert?: boolean;
  helper?: string;
  icon?: ReactNode;
  label: string;
  value: ReactNode;
}) {
  return (
    <div
      className="border-b px-5 py-4 md:border-r md:border-b-0 md:last:border-r-0"
      style={{ borderColor: STUDIO.rule }}
    >
      <p
        className="flex items-center gap-2 font-medium text-[11px] uppercase tracking-[0.06em]"
        style={{ color: STUDIO.ink3 }}
      >
        {icon}
        {label}
      </p>
      <p
        className="mt-2 text-4xl leading-none"
        style={{
          color: alert ? STUDIO.claret : STUDIO.ink,
          fontFamily: SERIF_STACK,
          fontWeight: 400,
          letterSpacing: 0,
        }}
      >
        {value}
      </p>
      {helper && (
        <p
          className="mt-1 text-xs"
          style={{
            color: alert ? STUDIO.claret : STUDIO.leaf,
            fontFamily: MONO_STACK,
          }}
        >
          {helper}
        </p>
      )}
    </div>
  );
}

const STATUS_STYLE: Record<
  string,
  { bg: string; border: string; color: string }
> = {
  accepted: {
    bg: "rgba(47,93,58,0.07)",
    border: "rgba(47,93,58,0.2)",
    color: STUDIO.leaf,
  },
  archived: {
    bg: STUDIO.paper2,
    border: STUDIO.rule2,
    color: STUDIO.ink3,
  },
  cancelled: {
    bg: "rgba(107,30,30,0.07)",
    border: "rgba(107,30,30,0.22)",
    color: STUDIO.claret,
  },
  closed: {
    bg: STUDIO.paper2,
    border: STUDIO.rule2,
    color: STUDIO.ink3,
  },
  draft: {
    bg: "rgba(176,138,62,0.09)",
    border: "rgba(176,138,62,0.24)",
    color: "#6a5118",
  },
  interview: {
    bg: "rgba(42,74,122,0.08)",
    border: "rgba(42,74,122,0.2)",
    color: STUDIO.sky,
  },
  pending: {
    bg: "rgba(176,138,62,0.09)",
    border: "rgba(176,138,62,0.24)",
    color: "#6a5118",
  },
  pending_approval: {
    bg: "rgba(176,138,62,0.09)",
    border: "rgba(176,138,62,0.24)",
    color: "#6a5118",
  },
  published: {
    bg: "rgba(47,93,58,0.07)",
    border: "rgba(47,93,58,0.2)",
    color: STUDIO.leaf,
  },
  rejected: {
    bg: "rgba(107,30,30,0.07)",
    border: "rgba(107,30,30,0.22)",
    color: STUDIO.claret,
  },
  reviewed: {
    bg: "rgba(42,74,122,0.08)",
    border: "rgba(42,74,122,0.2)",
    color: STUDIO.sky,
  },
  submitted: {
    bg: "rgba(176,138,62,0.09)",
    border: "rgba(176,138,62,0.24)",
    color: "#6a5118",
  },
};

export function StudioStatusPill({
  label,
  status,
  size = "sm",
}: {
  label?: string;
  size?: "sm" | "md";
  status: string;
}) {
  const style = STATUS_STYLE[status] ?? {
    bg: STUDIO.paper2,
    border: STUDIO.rule2,
    color: STUDIO.ink3,
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium uppercase tracking-[0.05em] ${
        size === "md" ? "px-3 py-1 text-xs" : "px-2.5 py-0.5 text-[11px]"
      }`}
      style={{
        background: style.bg,
        borderColor: style.border,
        color: style.color,
        fontFamily: MONO_STACK,
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: style.color }}
      />
      {label ?? status.replaceAll("_", " ")}
    </span>
  );
}

/** `accent` is the claret call to action, as on the benefits board. */
export type StudioButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "accent";

export function StudioButton({
  children,
  className = "",
  variant = "secondary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: StudioButtonVariant;
}) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 font-medium text-sm transition ${className}`}
      style={buttonStyle(variant)}
      type="button"
      {...props}
    >
      {children}
    </button>
  );
}

export function StudioLinkButton({
  children,
  className = "",
  href,
  variant = "secondary",
}: {
  children: ReactNode;
  className?: string;
  href: string;
  variant?: StudioButtonVariant;
}) {
  return (
    <Link
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 font-medium text-sm transition ${className}`}
      href={href}
      style={buttonStyle(variant)}
    >
      {children}
    </Link>
  );
}

export function buttonStyle(variant: StudioButtonVariant): CSSProperties {
  if (variant === "accent") {
    return {
      background: STUDIO.claret,
      border: `0.5px solid ${STUDIO.claret}`,
      boxShadow: "0 6px 22px rgba(107,30,30,0.2)",
      color: STUDIO.white,
    };
  }
  if (variant === "primary") {
    return {
      background: STUDIO.ink,
      border: `0.5px solid ${STUDIO.ink}`,
      boxShadow: "0 6px 22px rgba(26,24,20,0.18)",
      color: STUDIO.paper,
    };
  }
  if (variant === "danger") {
    return {
      background: "rgba(107,30,30,0.08)",
      border: "0.5px solid rgba(107,30,30,0.22)",
      color: STUDIO.claret,
    };
  }
  if (variant === "ghost") {
    return {
      background: "transparent",
      border: "0.5px solid transparent",
      color: STUDIO.ink3,
    };
  }
  return {
    background: "rgba(255,255,255,0.55)",
    border: `0.5px solid ${STUDIO.rule2}`,
    color: STUDIO.ink2,
  };
}

export function StudioIconBox({
  children,
  color = STUDIO.claret,
}: {
  children: ReactNode;
  color?: string;
}) {
  return (
    <span
      className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border"
      style={{
        background: "rgba(255,255,255,0.46)",
        borderColor: STUDIO.rule2,
        color,
      }}
    >
      {children}
    </span>
  );
}

export function StudioCrest({
  label,
  icon: Icon,
}: {
  icon?: ComponentType<{ size?: number }>;
  label: string;
}) {
  return (
    <span
      className="grid h-12 w-10 shrink-0 place-items-center rounded-md border text-xl"
      style={{
        background: STUDIO.paper2,
        borderColor: STUDIO.rule2,
        color: STUDIO.ink,
        fontFamily: SERIF_STACK,
      }}
    >
      {Icon ? <Icon size={16} /> : label.trim().charAt(0).toUpperCase()}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*                               Cover patterns                               */
/* -------------------------------------------------------------------------- */

/*
 * The fallback artwork the event and shop studios show for an item with no
 * image: a gradient per pattern with white line art over it. `pattern` is the
 * stored `cover_pattern` value; anything unknown gets the dotted default.
 */

export function studioCoverBackground(
  pattern: string | null | undefined
): string {
  switch (pattern) {
    case "linear":
      return "linear-gradient(135deg, #2a4a7a 0%, #15263c 100%)";
    case "concentric":
      return "linear-gradient(135deg, #2f5d3a 0%, #1a3422 100%)";
    case "wave":
      return "linear-gradient(135deg, #b08a3e 0%, #6a5118 100%)";
    case "grid":
      return "linear-gradient(180deg, #29261b 0%, #100e09 100%)";
    default:
      return "linear-gradient(135deg, #6b1e1e 0%, #2a1010 100%)";
  }
}

export function studioCoverPatternIndex(
  pattern: string | null | undefined
): number {
  switch (pattern) {
    case "linear":
      return 2;
    case "concentric":
      return 3;
    case "wave":
      return 4;
    case "grid":
      return 5;
    default:
      return 1;
  }
}

export function StudioCoverPattern({ which }: { which: number }) {
  const svgStyle: CSSProperties = {
    height: "100%",
    inset: 0,
    opacity: 0.3,
    position: "absolute",
    width: "100%",
  };

  if (which === 2) {
    return (
      <svg
        aria-hidden
        preserveAspectRatio="none"
        style={svgStyle}
        viewBox="0 0 200 130"
      >
        <title>Linear cover pattern</title>
        {Array.from({ length: 8 }).map((_, i) => (
          <line
            key={`line-${i}`}
            stroke="white"
            strokeWidth="0.5"
            x1="0"
            x2="200"
            y1={i * 18}
            y2={i * 18 - 30}
          />
        ))}
      </svg>
    );
  }
  if (which === 3) {
    return (
      <svg
        aria-hidden
        preserveAspectRatio="none"
        style={svgStyle}
        viewBox="0 0 200 130"
      >
        <title>Concentric cover pattern</title>
        {[80, 60, 40, 20].map((r) => (
          <circle
            cx="40"
            cy="100"
            fill="none"
            key={`circ-${r}`}
            r={r}
            stroke="white"
            strokeWidth="0.5"
          />
        ))}
      </svg>
    );
  }
  if (which === 4) {
    return (
      <svg
        aria-hidden
        preserveAspectRatio="none"
        style={svgStyle}
        viewBox="0 0 200 130"
      >
        <title>Wave cover pattern</title>
        {Array.from({ length: 10 }).map((_, i) => (
          <path
            d={`M0,${60 + i * 8} Q50,${40 + i * 8} 100,${60 + i * 8} T200,${60 + i * 8}`}
            fill="none"
            key={`wave-${i}`}
            opacity={1 - i * 0.06}
            stroke="white"
            strokeWidth="0.4"
          />
        ))}
      </svg>
    );
  }
  if (which === 5) {
    return (
      <svg
        aria-hidden
        preserveAspectRatio="none"
        style={svgStyle}
        viewBox="0 0 200 130"
      >
        <title>Grid cover pattern</title>
        <defs>
          <pattern
            height="22"
            id="studio-cover-grid"
            patternUnits="userSpaceOnUse"
            width="22"
          >
            <path d="M0 11h22M11 0v22" stroke="white" strokeWidth="0.3" />
          </pattern>
        </defs>
        <rect fill="url(#studio-cover-grid)" height="130" width="200" />
      </svg>
    );
  }
  return (
    <svg
      aria-hidden
      preserveAspectRatio="none"
      style={svgStyle}
      viewBox="0 0 200 130"
    >
      <title>Dotted cover pattern</title>
      <defs>
        <pattern
          height="14"
          id="studio-cover-dots"
          patternUnits="userSpaceOnUse"
          width="14"
        >
          <circle cx="2" cy="2" fill="white" r="1" />
        </pattern>
      </defs>
      <rect fill="url(#studio-cover-dots)" height="130" width="200" />
    </svg>
  );
}
