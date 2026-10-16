import { cn } from "@repo/ui/lib/utils";
import Image from "next/image";
import type { Partner } from "@/app/actions/about";
import { CardGrid } from "@/components/ui/card-grid";
import { ChevronFrame } from "@/components/ui/chevron-frame";
import { Section } from "@/components/ui/section";
import { SectionHeading } from "@/components/ui/section-heading";
import { PartnerLink } from "./partner-link";

/**
 * The national partners as a section of logos.
 *
 * Shared by the front page and `/about`, so a partner looks the same in both
 * places. Hook-free and free of
 * server-only imports — the heading arrives translated — so it renders inside
 * a Server Component and a client page alike. A partner with a `url` links
 * out through the tracked `PartnerLink`; one without is shown as its logo.
 *
 * Renders nothing for an empty list: a heading over no logos would be an
 * invented section.
 */
export interface PartnerGridProps {
  className?: string;
  /** Show at most this many; omit for all. */
  limit?: number;
  partners: Partner[];
  title: string;
}

export function PartnerGrid({
  className,
  limit,
  partners,
  title,
}: PartnerGridProps) {
  if (partners.length === 0) {
    return null;
  }
  const shown = limit === undefined ? partners : partners.slice(0, limit);

  return (
    <Section className={cn("border-edge border-t", className)} tone="paper">
      <SectionHeading>{title}</SectionHeading>
      <CardGrid columns={4}>
        {shown.map((partner) => {
          const logo = (
            <ChevronFrame
              className="border border-edge bg-surface-raised"
              ratio="16/9"
            >
              <Image
                alt={partner.name}
                className="object-contain p-4"
                height={120}
                sizes="(max-width: 640px) 50vw, 220px"
                src={partner.image_url}
                width={220}
              />
            </ChevronFrame>
          );
          return (
            <li key={partner.$id}>
              {partner.url ? (
                <PartnerLink name={partner.name} url={partner.url}>
                  {logo}
                </PartnerLink>
              ) : (
                logo
              )}
            </li>
          );
        })}
      </CardGrid>
    </Section>
  );
}
