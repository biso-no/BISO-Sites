import type { ReactNode } from "react";
import { CardGrid } from "@/components/ui/card-grid";
import { Section } from "@/components/ui/section";
import { SectionHeading } from "@/components/ui/section-heading";

interface AboutSectionProps {
  children: ReactNode;
  /** Small label above the title, as the merged page uses for "Academics". */
  eyebrow?: string;
  /** The anchor: the section menu, the nav and the retired subpages land here. */
  id: string;
  intro?: string;
  title: string;
}

/**
 * One section of the merged Om BISO page, in the content column beside the
 * section menu.
 *
 * `scroll-mt-*` keeps the heading clear of the fixed 80px header when an anchor
 * is followed — and, below `lg`, of the sticky section strip under it too.
 * Sections are separated by a hairline, never by alternating bands: the page
 * is one document, not a stack of promos.
 */
export function AboutSection({
  children,
  eyebrow,
  id,
  intro,
  title,
}: AboutSectionProps) {
  const headingId = `${id}-tittel`;
  return (
    <Section
      aria-labelledby={headingId}
      className="scroll-mt-36 border-edge border-t py-(--section-y) first:border-t-0 first:pt-0 last:pb-0 lg:scroll-mt-28"
      id={id}
      rhythm="none"
      width="none"
    >
      {eyebrow ? (
        <p className="type-label mb-3 text-ink-accent">{eyebrow}</p>
      ) : null}
      <SectionHeading className="mb-4" id={headingId}>
        {title}
      </SectionHeading>
      {intro ? (
        <p className="type-body mb-6 max-w-(--measure) text-ink-muted">
          {intro}
        </p>
      ) : null}
      {children}
    </Section>
  );
}

/** A block of pre-formatted copy from the message bundle. */
export function SectionCopy({ text }: { text: string }) {
  return (
    <div className="max-w-(--measure)">
      <p className="type-body whitespace-pre-line text-ink">{text}</p>
    </div>
  );
}

/** A titled block inside a section — the level under the section's `<h2>`. */
export function SubHeading({ children }: { children: ReactNode }) {
  return (
    <h3 className="type-heading-card mt-10 mb-4 break-words text-ink">
      {children}
    </h3>
  );
}

/** Title and blurb cards (political demands, cases won at BI, strategy). */
export function TitledCards({
  columns = 3,
  items,
}: {
  columns?: 2 | 3;
  items: { description: string; id: string; title: string }[];
}) {
  return (
    // The content column sits beside the section menu, so a third column only
    // fits from `xl`.
    <CardGrid
      className={columns === 3 ? "xl:grid-cols-3" : undefined}
      columns={2}
    >
      {items.map((item) => (
        <li
          className="flex h-full flex-col rounded-biso-md border border-edge p-6"
          key={item.id}
        >
          <h4 className="type-heading-card break-words text-ink">
            {item.title}
          </h4>
          <p className="type-body-sm mt-2 text-ink-muted">{item.description}</p>
        </li>
      ))}
    </CardGrid>
  );
}

/** Forums and committees: a term and what it does. */
export function ForumList({
  items,
}: {
  items: { description: string; id: string; title: string }[];
}) {
  return (
    <dl className="max-w-(--measure)">
      {items.map((item) => (
        <div
          className="border-edge border-b py-4 first:pt-0 last:border-b-0"
          key={item.id}
        >
          <dt className="type-heading-card text-ink">{item.title}</dt>
          <dd className="type-body mt-1 text-ink-muted">{item.description}</dd>
        </div>
      ))}
    </dl>
  );
}
