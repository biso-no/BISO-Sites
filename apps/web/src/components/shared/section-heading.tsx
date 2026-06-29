import { cn } from "@repo/ui/lib/utils";

interface SectionHeadingProps {
  align?: "left" | "center";
  className?: string;
  gradient?: boolean;
  label?: string;
  subtitle?: string;
  title: string;
}

/**
 * Shared section header: an optional brand-muted label pill, a heading (with an
 * optional brand gradient-text variant), and an optional subtitle. Mirrors the
 * inline pattern used across the polished public pages (/about, /business).
 */
export function SectionHeading({
  align = "left",
  className,
  gradient = false,
  label,
  subtitle,
  title,
}: SectionHeadingProps) {
  return (
    <div className={cn(align === "center" && "text-center", className)}>
      {label ? (
        <div className="mb-4 inline-block rounded-full bg-brand-muted px-4 py-2 font-medium text-brand-dark text-sm">
          {label}
        </div>
      ) : null}
      <h2 className="font-bold text-2xl text-foreground md:text-3xl">
        {gradient ? (
          <span className="bg-linear-to-r from-brand-gradient-from to-brand-gradient-to bg-clip-text text-transparent">
            {title}
          </span>
        ) : (
          title
        )}
      </h2>
      {subtitle ? (
        <p
          className={cn(
            "mt-3 text-muted-foreground leading-relaxed",
            align === "center" && "mx-auto max-w-2xl"
          )}
        >
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}
