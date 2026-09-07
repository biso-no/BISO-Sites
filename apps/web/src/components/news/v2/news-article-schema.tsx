import type { News } from "@repo/api/types/appwrite";
import { serializeJsonLd } from "@/lib/json-ld";

/**
 * The `NewsArticle` structured data, lifted out of the page so both versions
 * emit exactly the same payload.
 *
 * Same reason `JobPostingSchema` was extracted in RD-019: the schema is the
 * part of an article page that search engines read, and quietly dropping it
 * while restyling would be an invisible SEO regression on an indexed route.
 */
export interface NewsArticleSchemaProps {
  article: News;
  locale: string;
  slug: string;
  summary: string;
  title: string;
}

export function NewsArticleSchema({
  article,
  locale,
  slug,
  summary,
  title,
}: NewsArticleSchemaProps) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: title,
    description: summary,
    datePublished: article.$createdAt,
    dateModified: article.$updatedAt,
    inLanguage: locale === "no" ? "nb-NO" : "en",
    image: article.image ? [article.image] : undefined,
    author: article.author
      ? { "@type": "Person", name: article.author }
      : { "@type": "Organization", name: "BI Student Organisation" },
    publisher: {
      "@type": "Organization",
      name: "BI Student Organisation",
    },
    mainEntityOfPage: `${process.env.NEXT_PUBLIC_BASE_URL ?? "https://web.biso.no"}/news/${slug}`,
  };

  return (
    <script
      // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD payload, HTML-escaped by serializeJsonLd.
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      type="application/ld+json"
    />
  );
}
