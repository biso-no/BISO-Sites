import { cn } from "@repo/ui/lib/utils";
import type { CSSProperties, ReactNode } from "react";

// Light grid on the navy hero (the repo's bg-grid-primary uses dark ink meant
// for light surfaces, so it would be invisible here). Top-level constant to keep
// the object out of the render path.
const GRID_STYLE: CSSProperties = {
  backgroundImage:
    "linear-gradient(to right, rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.5) 1px, transparent 1px)",
  backgroundSize: "44px 44px",
};

interface ShopHeroShellProps {
  /** Badges, CTAs or other content rendered under the title block. */
  children?: ReactNode;
  className?: string;
  /** Small label above the title. */
  eyebrow?: ReactNode;
  /** Defaults to a comfortable mid-height band. */
  heightClass?: string;
  subtitle?: ReactNode;
  title: ReactNode;
  /** Optional absolutely-positioned slot (e.g. a back link). */
  topLeft?: ReactNode;
}

/**
 * Shared branded hero for the webshop: navy base, faint grid, a blue glow and a
 * single yellow accent bar under the title. No photo asset — consistent across
 * shop / cart / checkout / order. Presentational (no hooks) so it works in both
 * server and client trees.
 */
export function ShopHeroShell({
  title,
  subtitle,
  eyebrow,
  children,
  topLeft,
  heightClass = "h-[42vh] min-h-[320px]",
  className,
}: ShopHeroShellProps) {
  return (
    <section
      className={cn(
        "relative isolate flex items-center justify-center overflow-hidden bg-brand-dark",
        heightClass,
        className
      )}
    >
      <div
        aria-hidden
        className="absolute inset-0 bg-linear-to-br from-brand-dark via-brand/25 to-brand-dark"
      />
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.12]"
        style={GRID_STYLE}
      />
      <div
        aria-hidden
        className="absolute -top-32 -left-32 h-[28rem] w-[28rem] rounded-full bg-brand/30 blur-3xl"
      />
      <div
        aria-hidden
        className="absolute -right-24 bottom-[-8rem] h-80 w-80 rounded-full bg-brand-accent/10 blur-3xl"
      />

      {topLeft}

      <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center px-4 text-center">
        {eyebrow ? <div className="mb-4">{eyebrow}</div> : null}
        <h1 className="text-balance font-bold text-4xl text-white tracking-tight md:text-5xl">
          {title}
        </h1>
        <div className="mt-5 h-1 w-16 rounded-full bg-brand-accent" />
        {subtitle ? (
          <p className="mt-5 max-w-2xl text-balance text-white/80 md:text-lg">
            {subtitle}
          </p>
        ) : null}
        {children ? <div className="mt-6">{children}</div> : null}
      </div>
    </section>
  );
}
