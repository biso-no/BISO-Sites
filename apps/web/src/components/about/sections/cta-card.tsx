import { ArrowUpRight, FileText } from "lucide-react";
import Link from "next/link";
import { statusPanelPrimaryAction } from "@/components/ui/status-panel";

interface CtaCardProps {
  cta: string;
  description: string;
  external?: boolean;
  href: string;
  title: string;
}

/**
 * Title, blurb and one action — SPU, "your case", SAIH. A bordered row, not a
 * gradient panel with an icon tile: the action carries the colour.
 */
export function CtaCard({
  cta,
  description,
  external,
  href,
  title,
}: CtaCardProps) {
  return (
    <div className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-biso-md border border-edge p-6">
      <div className="min-w-0 max-w-(--measure)">
        <p className="type-heading-card break-words text-ink">{title}</p>
        <p className="type-body-sm mt-1 text-ink-muted">{description}</p>
      </div>
      {external ? (
        <a
          className={statusPanelPrimaryAction}
          href={href}
          rel="noopener noreferrer"
          target="_blank"
        >
          {cta}
          <ArrowUpRight aria-hidden="true" className="size-4 shrink-0" />
        </a>
      ) : (
        <Link className={statusPanelPrimaryAction} href={href}>
          {cta}
        </Link>
      )}
    </div>
  );
}

/** A published PDF on SharePoint: the political and academic target documents. */
export function PdfLink({
  description,
  href,
  title,
}: {
  description: string;
  href: string;
  title: string;
}) {
  return (
    <a
      className="group mt-4 flex items-start gap-3 rounded-biso-md border border-edge p-6 transition-colors hover:border-ink-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
      href={href}
      rel="noopener noreferrer"
      target="_blank"
    >
      <FileText
        aria-hidden="true"
        className="mt-0.5 size-5 shrink-0 text-ink-accent"
      />
      <span className="min-w-0">
        <span className="type-heading-card block break-words text-ink group-hover:text-ink-accent">
          {title}
        </span>
        <span className="type-body-sm mt-1 block text-ink-muted">
          {description}
        </span>
      </span>
    </a>
  );
}
