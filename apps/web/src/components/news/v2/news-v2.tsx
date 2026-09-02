import type { News } from "@repo/api/types/appwrite";
import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CardGrid } from "@/components/ui/card-grid";
import { ChevronFrame } from "@/components/ui/chevron-frame";
import { FilterChips, type FilterOption } from "@/components/ui/filter-chips";
import { PageHeader } from "@/components/ui/page-header";
import { Pill } from "@/components/ui/pill";
import { Section } from "@/components/ui/section";
import { CAMPUS_SLUGS, campusIdToSlug } from "@/lib/campus-scope";
import { toPlainText } from "@/lib/content-text";
import { getPrimaryTranslation } from "@/lib/content-translation";
import { buildSummary, formatArticleDate } from "@/lib/news-article";
import { NewsSearch } from "./news-search";

/**
 * The news feed, rebuilt as a Server Component.
 *
 * **PLACEHOLDER-003.** The reference shows a category pill on every card —
 * EVENT RECAP / STUDENT STORIES / CAMPUS NEWS. `News` has no category column,
 * only an untyped `metadata: string[]`, and that array is **empty on every
 * published row**. So no pill is rendered and no category chip is offered:
 * inventing three categories to match a mockup would be inventing content. The
 * smallest real fix is a `category` enum on `news`, mirroring the eight-value
 * `EventsCategory` that already exists.
 *
 * v1 renders a category filter regardless — a hardcoded `categories = ["All"]`,
 * one chip, matching everything. `FilterChips` declines to render a group with
 * fewer than two options, so that control disappears on its own here.
 *
 * Search keeps working and keeps its URL: `?search=` is already read on the
 * server by `filterArticles`, and `<NewsSearch>` is a real GET form rather than
 * `useState` plus `router.push`.
 */
export interface NewsV2Props {
  articles: News[];
  campusId: string | null;
  locale: "en" | "no";
  searchParams: Record<string, string | string[] | undefined>;
  searchQuery: string;
}

function ArticleCard({
  article,
  locale,
  featuredLabel,
  showMedia,
}: {
  article: News;
  featuredLabel: string;
  locale: "en" | "no";
  showMedia: boolean;
}) {
  const translation = getPrimaryTranslation(article, locale);
  const summary = buildSummary(
    translation?.short_description,
    toPlainText(translation?.description ?? "")
  );

  return (
    <li>
      <Link
        className="group flex h-full flex-col rounded-biso-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-4 focus-visible:ring-offset-surface"
        href={`/news/${article.slug}`}
      >
        {/* The frame is drawn for every card once any card in the feed has an
            image, so a picture-less article does not float its headline to the
            top of the row while its neighbours start below a photo. Empty, it
            is a tinted shape — a frame with nothing in it, not a stand-in
            picture. One stored `image` currently 404s in Appwrite storage, and
            it degrades to the same tint rather than to a hole. */}
        {showMedia ? (
          <ChevronFrame className="bg-surface-sunken" ratio="16/9">
            {article.image ? (
              <Image
                alt=""
                className="transition-transform duration-500 group-hover:scale-[1.03]"
                height={360}
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 380px"
                src={article.image}
                width={640}
              />
            ) : null}
          </ChevronFrame>
        ) : null}

        {/* Sticky is the only classification the data actually carries. */}
        {article.sticky ? (
          <span className="mt-4 flex">
            <Pill tone="marker" uppercase>
              {featuredLabel}
            </Pill>
          </span>
        ) : null}

        <span className="type-data mt-4 block text-ink-muted">
          {formatArticleDate(article.$createdAt, locale, "short")}
          {article.campus?.name ? ` · ${article.campus.name}` : ""}
        </span>

        <span className="type-heading-card mt-2 block text-ink group-hover:text-ink-accent">
          {translation?.title}
        </span>

        {summary ? (
          <span className="type-body-sm mt-2 line-clamp-3 text-ink-muted">
            {summary}
          </span>
        ) : null}

        {article.author ? (
          <span className="type-label mt-auto pt-4 text-ink-muted">
            {article.author}
          </span>
        ) : null}
      </Link>
    </li>
  );
}

export async function NewsV2({
  articles,
  campusId,
  locale,
  searchParams,
  searchQuery,
}: NewsV2Props) {
  const [t, tCommon, tNav] = await Promise.all([
    getTranslations("news"),
    getTranslations("common"),
    getTranslations("common.navigation"),
  ]);

  const campusOptions: FilterOption[] = [
    { value: "all", label: tNav("allCampuses") },
    ...CAMPUS_SLUGS.map((slug) => ({
      value: slug,
      label: slug.charAt(0).toUpperCase() + slug.slice(1),
    })),
  ];

  // Sticky articles lead, then everything else newest first. `queryNews`
  // already orders by `$createdAt` descending; this only lifts the pinned ones.
  //
  // They lead *within the one grid* rather than in a band of their own: with a
  // single pinned article — the current state — a separate section is one card
  // in a three-column row and two-thirds white space. The pill is what marks an
  // article as featured, and it works at any count.
  const ordered = [
    ...articles.filter((article) => article.sticky),
    ...articles.filter((article) => !article.sticky),
  ];

  const activeCampus = campusIdToSlug(campusId) ?? "all";
  const hidden: Record<string, string> = {};
  if (activeCampus !== "all") {
    hidden.campus = activeCampus;
  }

  const cardProps = {
    featuredLabel: t("list.featured"),
    locale,
    showMedia: articles.some((article) => Boolean(article.image)),
  };

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: tCommon("breadcrumbs.home"), href: "/" },
          { label: tNav("news") },
        ]}
        lede={t("hero.description")}
        title={tNav("news")}
      />

      <Section tone="paper">
        <div className="mb-8 space-y-4">
          <NewsSearch
            defaultValue={searchQuery}
            hidden={hidden}
            label={t("list.searchLabel")}
            placeholder={t("list.searchPlaceholder")}
            submitLabel={t("list.searchSubmit")}
          />
          <FilterChips
            active={activeCampus}
            basePath="/news"
            label={t("list.campusLabel")}
            options={campusOptions}
            param="campus"
            searchParams={searchParams}
          />
        </div>

        <p className="type-body-sm mb-6 text-ink-muted">
          {t("list.results", { count: articles.length })}
        </p>

        {articles.length === 0 ? (
          <div>
            <p className="type-heading-card text-ink">{t("list.emptyTitle")}</p>
            <p className="type-body mt-2 text-ink-muted">
              {t("list.emptyBody")}
            </p>
            <Link
              className="type-label mt-5 inline-flex text-ink-accent underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              href="/news"
            >
              {t("list.clear")}
            </Link>
          </div>
        ) : null}

        {ordered.length > 0 ? (
          <CardGrid className="gap-x-6 gap-y-10">
            {ordered.map((article) => (
              <ArticleCard article={article} key={article.$id} {...cardProps} />
            ))}
          </CardGrid>
        ) : null}
      </Section>
    </>
  );
}
