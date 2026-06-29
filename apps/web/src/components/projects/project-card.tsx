import { Badge } from "@repo/ui/components/ui/badge";
import { Card } from "@repo/ui/components/ui/card";
import { cn } from "@repo/ui/lib/utils";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

interface ProjectCardProps {
  badge: string;
  ctaLabel: string;
  description: string;
  formattedDate?: string;
  gradient: string[];
  href: string;
  title: string;
  variant: "featured" | "schedule";
}

/**
 * Event card used by both the featured grid and the schedule grid on /projects.
 * Carries a per-project gradient accent bar, a category badge, a line-clamped
 * description, an optional formatted date, and an animated arrow CTA. Wrap the
 * call site in a `motion.div` for staggered scroll-in.
 */
export function ProjectCard({
  badge,
  ctaLabel,
  description,
  formattedDate,
  gradient,
  href,
  title,
  variant,
}: ProjectCardProps) {
  const accent = `linear-gradient(90deg, ${gradient.join(", ")})`;
  const isFeatured = variant === "featured";

  return (
    <Link className="block h-full" href={href}>
      <Card className="group flex h-full flex-col overflow-hidden border border-border/50 bg-card/80 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-brand/30 hover:shadow-xl">
        <div className="h-1.5 w-full shrink-0" style={{ background: accent }} />
        <div className="flex flex-1 flex-col gap-3 p-6">
          <Badge
            className="w-fit uppercase tracking-wide"
            variant={isFeatured ? "secondary" : "outline"}
          >
            {badge}
          </Badge>
          <h3
            className={cn(
              "font-semibold text-foreground transition-colors group-hover:text-brand",
              isFeatured ? "text-2xl" : "text-lg"
            )}
          >
            {title}
          </h3>
          <p className="line-clamp-3 text-muted-foreground text-sm leading-relaxed">
            {description}
          </p>
          <div className="mt-auto flex items-center justify-between gap-3 pt-2">
            <span className="text-muted-foreground text-xs">
              {formattedDate ?? ""}
            </span>
            <span className="inline-flex items-center gap-1 font-medium text-brand text-sm">
              {ctaLabel}
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
