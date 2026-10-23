"use client";

import { ChevronMedia } from "@/blocks/_v2/chevron-media";
import { FeedCardShell, FeedSection } from "@/blocks/_v2/feed-section";
import { useBlockFeed } from "@/blocks/_v2/use-block-feed";
import type { PatchFn } from "@/blocks/types";
import type { NewsBlock } from "@/editor/types";

interface FeedArticle {
  department?: string;
  href?: string;
  id?: string;
  image?: string;
  publishedAt?: string;
  publishedAtIso?: string;
  summary?: string;
  title?: string;
}

const CARD = "group flex h-full flex-col rounded-biso-sm";

function ArticleCard({
  article,
  edit,
  showMedia,
}: {
  article: FeedArticle;
  edit: boolean;
  showMedia: boolean;
}) {
  const meta = [article.publishedAt, article.department]
    .filter(Boolean)
    .join(" · ");
  return (
    <FeedCardShell className={CARD} edit={edit} href={article.href}>
      {/* Drawn for every card once any card has an image, so a picture-less
          article does not float its headline above its neighbours'. */}
      {showMedia ? (
        <ChevronMedia ratio="16/9" src={article.image ?? ""} width={640} />
      ) : null}
      {meta ? (
        <time
          className="type-data mt-4 block text-ink-muted"
          dateTime={article.publishedAtIso}
        >
          {meta}
        </time>
      ) : null}
      <span className="type-heading-card mt-2 block text-ink group-hover:text-ink-accent">
        {article.title}
      </span>
      {article.summary ? (
        <span className="type-body-sm mt-2 line-clamp-3 text-ink-muted">
          {article.summary}
        </span>
      ) : null}
    </FeedCardShell>
  );
}

interface Props {
  block: NewsBlock;
  edit: boolean;
  onPatch: PatchFn;
}

export function NewsRender({ block, edit, onPatch }: Props) {
  const { dept, items, locale } = useBlockFeed<FeedArticle>(
    "news",
    block.source,
    block.limit
  );
  const showMedia = (items ?? []).some((article) => Boolean(article.image));
  return (
    <FeedSection
      dept={dept}
      edit={edit}
      heading={block.heading}
      items={items}
      locale={locale}
      noun="news"
      onPatch={onPatch}
      seeAll={block.seeAll !== false}
      seeAllHref="/news"
    >
      {(items ?? []).map((article, i) => (
        <ArticleCard
          article={article}
          edit={edit}
          key={article.id ?? i}
          showMedia={showMedia}
        />
      ))}
    </FeedSection>
  );
}
