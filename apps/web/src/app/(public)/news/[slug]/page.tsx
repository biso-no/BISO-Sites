import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getLocale } from "@/app/actions/locale";
import { getNewsBySlug, listNews } from "@/app/actions/news";
import { ArticleBody } from "@/components/news/article-body";
import { ArticleHero } from "@/components/news/article-hero";
import { ArticleMetaRail } from "@/components/news/article-meta-rail";
import { ArticleSkeleton } from "@/components/news/article-skeleton";
import { RelatedArticles } from "@/components/news/related-articles";
import { toPlainText } from "@/lib/content-text";
import { serializeJsonLd } from "@/lib/json-ld";
import {
  buildLead,
  buildSummary,
  formatArticleDate,
  pickTranslation,
  readingMinutes,
} from "@/lib/news-article";

const RELATED_COUNT = 3;
const RELATED_POOL = 8;

interface NewsDetailProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: NewsDetailProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const locale = await getLocale();
    const item = await getNewsBySlug(slug, locale);
    const translation = pickTranslation(item);
    if (!translation) {
      return { title: "News | BISO" };
    }

    const description = buildSummary(
      translation.short_description,
      toPlainText(translation.description)
    );

    return {
      title: `${translation.title} | BISO`,
      description,
      openGraph: {
        type: "article",
        title: translation.title,
        description,
        publishedTime: item?.$createdAt,
        images: item?.image ? [item.image] : undefined,
      },
    };
  } catch {
    return { title: "News | BISO" };
  }
}

async function NewsArticle({ slug }: { slug: string }) {
  const locale = await getLocale();
  const item = await getNewsBySlug(slug, locale);

  if (!item || (item.status && item.status !== "published")) {
    return notFound();
  }

  const translation = pickTranslation(item);
  const title = translation?.title ?? "";
  const body = translation?.description ?? "";
  const plainBody = toPlainText(body);
  const lead = buildLead(translation?.short_description, plainBody);
  const summary = buildSummary(translation?.short_description, plainBody);

  // Same-campus articles lead the "keep reading" row; everything else fills in
  // behind them, so a Bergen reader is offered Bergen stories first.
  const pool = await listNews({
    locale,
    status: "published",
    limit: RELATED_POOL,
  });
  const related = pool
    .filter((entry) => entry.$id !== item.$id)
    .sort((a, b) => {
      const aLocal = a.campus_id === item.campus_id ? 0 : 1;
      const bLocal = b.campus_id === item.campus_id ? 0 : 1;
      return aLocal - bLocal;
    })
    .slice(0, RELATED_COUNT);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: title,
    description: summary,
    datePublished: item.$createdAt,
    dateModified: item.$updatedAt,
    inLanguage: locale === "no" ? "nb-NO" : "en",
    image: item.image ? [item.image] : undefined,
    author: item.author
      ? { "@type": "Person", name: item.author }
      : { "@type": "Organization", name: "BI Student Organisation" },
    publisher: {
      "@type": "Organization",
      name: "BI Student Organisation",
    },
    mainEntityOfPage: `${process.env.NEXT_PUBLIC_BASE_URL ?? "https://web.biso.no"}/news/${slug}`,
  };

  return (
    <div className="bg-background">
      <script
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD payload, HTML-escaped by serializeJsonLd.
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
        type="application/ld+json"
      />

      <ArticleHero article={item} lead={lead} title={title} />

      {/* The reading card rides up over the hero — the article starts before
          the image ends, which is what makes the page read as one story. */}
      <div className="relative z-10 mx-auto -mt-16 max-w-6xl px-4 pb-20 sm:px-6 lg:px-8 lg:pb-28">
        <div className="rounded-3xl border border-brand-border bg-card p-6 shadow-[0_30px_70px_-40px_rgba(0,23,49,0.5)] sm:p-10 lg:p-14">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] lg:gap-16">
            <ArticleMetaRail
              articleId={item.$id}
              author={item.author}
              lead={summary}
              minutes={readingMinutes(plainBody)}
              publishedOn={formatArticleDate(item.$createdAt, locale)}
              title={title}
            />
            <ArticleBody value={body} />
          </div>
        </div>
      </div>

      <RelatedArticles articles={related} />
    </div>
  );
}

export default async function PublicNewsDetailBySlug({
  params,
}: NewsDetailProps) {
  const { slug } = await params;
  return (
    <Suspense fallback={<ArticleSkeleton />}>
      <NewsArticle slug={slug} />
    </Suspense>
  );
}
