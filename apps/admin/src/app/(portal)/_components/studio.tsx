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

export function StudioKpiStrip({ children }: { children: ReactNode }) {
  return (
    <section
      className="grid overflow-hidden rounded-2xl md:grid-cols-4"
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

export function StudioButton({
  children,
  className = "",
  variant = "secondary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
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
  variant?: "primary" | "secondary" | "ghost" | "danger";
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

export function buttonStyle(
  variant: "primary" | "secondary" | "ghost" | "danger"
): CSSProperties {
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
