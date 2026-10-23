"use client";

import { ChevronMedia } from "@/blocks/_v2/chevron-media";
import { FeedCardShell, FeedSection } from "@/blocks/_v2/feed-section";
import { listOf } from "@/blocks/_v2/list";
import { Pill } from "@/blocks/_v2/pill";
import type { PatchFn } from "@/blocks/types";
import { usePageFeedSource } from "@/editor/page-feed-context";
import {
  pageFeedKey,
  resolveFeedDepartment,
  shopBlockLimit,
} from "@/editor/page-feeds";
import type { EditorLocale, ProductGridBlock } from "@/editor/types";
import { useAutoFeed } from "@/editor/use-auto-feed";

interface FeedProduct {
  href?: string;
  id?: string;
  image?: string;
  memberOnly?: boolean;
  memberPrice?: number;
  price?: number;
  soldOut?: boolean;
  title?: string;
}

/** Same words as the unit page's shop (`units.detail.shop.*`). */
const LABELS: Record<
  EditorLocale,
  { forMembers: (price: string) => string; members: string; soldOut: string }
> = {
  en: {
    forMembers: (price) => `${price} for members`,
    members: "Members only",
    soldOut: "Sold out",
  },
  no: {
    forMembers: (price) => `${price} for medlemmer`,
    members: "Kun for medlemmer",
    soldOut: "Utsolgt",
  },
};

const CARD = "group flex h-full flex-col rounded-biso-sm";

function ProductCard({
  edit,
  locale,
  product,
}: {
  edit: boolean;
  locale: EditorLocale;
  product: FeedProduct;
}) {
  const labels = LABELS[locale] ?? LABELS.no;
  const hasMemberPrice = typeof product.memberPrice === "number";
  return (
    <FeedCardShell className={CARD} edit={edit} href={product.href}>
      {product.image ? (
        <ChevronMedia
          className="mb-4 bg-surface-sunken"
          ratio="16/9"
          src={product.image}
          width={640}
        />
      ) : null}
      {product.memberOnly || product.soldOut ? (
        <span className="mb-3 flex flex-wrap gap-2">
          {product.memberOnly ? (
            <Pill tone="warning">{labels.members}</Pill>
          ) : null}
          {product.soldOut ? <Pill tone="danger">{labels.soldOut}</Pill> : null}
        </span>
      ) : null}
      <span className="type-heading-card block break-words text-ink group-hover:text-ink-accent">
        {product.title}
      </span>
      <span className="mt-auto pt-4">
        <span className="type-heading-card block text-ink">
          {product.price} kr
        </span>
        {hasMemberPrice ? (
          <span className="type-body-sm mt-1 block text-ink-muted">
            {labels.forMembers(`${product.memberPrice} kr`)}
          </span>
        ) : null}
      </span>
    </FeedCardShell>
  );
}

interface Props {
  block: ProductGridBlock;
  edit: boolean;
  onPatch: PatchFn;
}

export function ProductGridRender({ block, edit, onPatch }: Props) {
  const { department, locale } = usePageFeedSource();
  const dept = resolveFeedDepartment(block.source, department);
  const limit = shopBlockLimit(block.limit);
  const { items } = useAutoFeed<FeedProduct>({
    enabled: !!dept,
    key: pageFeedKey("products", dept, locale, limit),
    url: `/api/pages/products?dept=${encodeURIComponent(dept)}&locale=${locale}&limit=${limit}`,
  });
  const products =
    items === null ? null : listOf<FeedProduct>(items).slice(0, limit);

  return (
    <FeedSection
      columns={4}
      dept={dept}
      edit={edit}
      heading={block.heading ?? ""}
      items={products}
      locale={locale}
      noun="products"
      onPatch={onPatch}
      seeAll={false}
      seeAllHref=""
    >
      {(products ?? []).map((product, i) => (
        <ProductCard
          edit={edit}
          key={product.id ?? i}
          locale={locale}
          product={product}
        />
      ))}
    </FeedSection>
  );
}
