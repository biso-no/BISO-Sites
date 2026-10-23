"use client";

import { ChevronMedia } from "@/blocks/_v2/chevron-media";
import { FeedCardShell, FeedSection } from "@/blocks/_v2/feed-section";
import { listOf } from "@/blocks/_v2/list";
import type { PatchFn } from "@/blocks/types";
import { usePageFeedSource } from "@/editor/page-feed-context";
import { pageFeedKey } from "@/editor/page-feeds";
import type { PartnerItem, PartnersBlock } from "@/editor/types";
import { useAutoFeed } from "@/editor/use-auto-feed";

interface Props {
  block: PartnersBlock;
  edit: boolean;
  onPatch: PatchFn;
}

const CARD = "block rounded-biso-sm";

function logoOf(partner: PartnerItem): { mime?: string; src: string } | null {
  const src = partner.logo?.src || partner.logoSrc;
  return src ? { mime: partner.logo?.mime, src } : null;
}

function PartnerCard({
  edit,
  partner,
}: {
  edit: boolean;
  partner: PartnerItem;
}) {
  const logo = logoOf(partner);
  const name = typeof partner.name === "string" ? partner.name : "";
  return (
    <FeedCardShell className={CARD} edit={edit} href={partner.href}>
      {logo ? (
        <ChevronMedia
          alt={name}
          className="border border-edge bg-surface-raised"
          imageClassName="object-contain p-4"
          mime={logo.mime}
          ratio="16/9"
          src={logo.src}
          width={440}
        />
      ) : (
        <span className="type-heading-card flex aspect-video items-center justify-center border border-edge bg-surface-raised p-4 text-center text-ink">
          {name}
        </span>
      )}
    </FeedCardShell>
  );
}

export function PartnersRender({ block, edit, onPatch }: Props) {
  const { locale } = usePageFeedSource();
  const isAuto = block.source === "auto";
  const { items: live } = useAutoFeed<PartnerItem>({
    enabled: isAuto,
    key: pageFeedKey("partners"),
    url: "/api/pages/partners",
  });
  const resolved = isAuto ? live : block.items;
  const items = resolved === null ? null : listOf<PartnerItem>(resolved);

  return (
    <FeedSection
      columns={4}
      dept=""
      edit={edit}
      heading={block.heading ?? ""}
      items={items}
      locale={locale}
      noun="partners to show yet"
      onPatch={onPatch}
      requireDept={false}
      seeAll={false}
      seeAllHref=""
    >
      {(items ?? []).map((partner, i) => (
        <PartnerCard
          edit={edit}
          key={`${partner.name}-${i}`}
          partner={partner}
        />
      ))}
    </FeedSection>
  );
}
