import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getLocale } from "@/app/actions/locale";
import { getNewsBySlug, listNews } from "@/app/actions/news";
import { NewsDetailV2 } from "@/components/news/v2/news-detail-v2";
import { DetailSkeleton } from "@/components/ui/loading-shell";
import { toPlainText } from "@/lib/content-text";
import { buildSummary, pickTranslation } from "@/lib/news-article";

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

/**
 * Same reads as `NewsArticle`, rendered on the design system. The data path is
 * untouched — `getNewsBySlug`, the same campus-first related pool — so v1 keeps
 * behaving exactly as it does with the flag off.
 */
async function NewsArticleV2({ slug }: { slug: string }) {
  const locale = await getLocale();
  const item = await getNewsBySlug(slug, locale);

  if (!item || (item.status && item.status !== "published")) {
    notFound();
  }

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

  return (
    <NewsDetailV2
      article={item}
      locale={locale}
      related={related}
      slug={slug}
    />
  );
}

export default async function PublicNewsDetailBySlug({
  params,
}: NewsDetailProps) {
  const { slug } = await params;

  return (
    <Suspense fallback={<DetailSkeleton />}>
      <NewsArticleV2 slug={slug} />
    </Suspense>
  );
}
