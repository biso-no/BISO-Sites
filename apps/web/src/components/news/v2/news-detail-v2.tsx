import type { News } from "@repo/api/types/appwrite";
import { PlateContentRenderer } from "@repo/ui/components/plate-content-renderer";
import { ArrowLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { CardGrid } from "@/components/ui/card-grid";
import { ChevronFrame } from "@/components/ui/chevron-frame";
import { CopyLinkButton } from "@/components/ui/copy-link-button";
import { PageHeader } from "@/components/ui/page-header";
import { Pill } from "@/components/ui/pill";
import { Prose } from "@/components/ui/prose";
import { Section } from "@/components/ui/section";
import { SectionHeading } from "@/components/ui/section-heading";
import { toPlainText } from "@/lib/content-text";
import { getPrimaryTranslation } from "@/lib/content-translation";
import {
  buildSummary,
  formatArticleDate,
  readingMinutes,
} from "@/lib/news-article";
import { NewsArticleSchema } from "./news-article-schema";

/**
 * The article page, rebuilt on the design system.
 *
 * The one thing that had to be measured rather than assumed: the plan recorded
 * the body as `max-w-4xl` (~100 characters), over the brief's 80-character
 * floor. It is not — v1 already caps at `max-w-[68ch]`. But `ch` is the advance
 * of "0", which is wider than average prose, so 68ch does **not** render 68
 * characters; at `prose-lg` it renders well past the floor. The body uses
 * `<Prose>` here, whose `--measure` was tuned by counting rendered characters
 * rather than by arithmetic (spec §1.5).
 *
 * The meta rail keeps everything v1 put in it — published date, reading time,
 * author, share — because every row is a fact about the article rather than
 * decoration. It gains the campus, which the row already carried and the page
 * never showed.
 */
export interface NewsDetailV2Props {
  article: News;
  locale: "en" | "no";
  related: News[];
  slug: string;
}

function RailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="lg:block">
      <dt className="type-label text-ink-muted">{label}</dt>
      <dd className="type-body-sm mt-1 text-ink">{value}</dd>
    </div>
  );
}

function RelatedArticle({
  article,
  locale,
}: {
  article: News;
  locale: "en" | "no";
}) {
  return (
    <li>
      <Link
        className="group flex h-full flex-col rounded-biso-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-4 focus-visible:ring-offset-surface"
        href={`/news/${article.slug}`}
      >
        {article.image ? (
          <ChevronFrame className="bg-surface-sunken" ratio="16/9">
            <Image
              alt=""
              height={270}
              sizes="(max-width: 640px) 100vw, 320px"
              src={article.image}
              width={480}
            />
          </ChevronFrame>
        ) : null}
        <span className="type-data mt-4 block text-ink-muted">
          {formatArticleDate(article.$createdAt, locale, "short")}
        </span>
        <span className="type-heading-card mt-2 block text-ink group-hover:text-ink-accent">
          {getPrimaryTranslation(article, locale)?.title}
        </span>
      </Link>
    </li>
  );
}

export async function NewsDetailV2({
  article,
  locale,
  related,
  slug,
}: NewsDetailV2Props) {
  const [t, tCommon, tNav] = await Promise.all([
    getTranslations("news.article"),
    getTranslations("common"),
    getTranslations("common.navigation"),
  ]);

  const translation = getPrimaryTranslation(article, locale);
  const title = translation?.title ?? "";
  const body = translation?.description ?? "";
  const plainBody = toPlainText(body);
  // The header lede is the *authored* summary only. The auto-lead helper
  // stands the opening 200 characters of the body in when there is none —
  // useful where the body is elsewhere, but here it sits directly above that
  // same paragraph, so the page opened by saying the same sentence twice and
  // cutting the first one off mid-word. No `short_description` is currently
  // written on any article, so today that means no lede: the story starts at
  // the headline.
  const lead = translation?.short_description?.trim() || undefined;
  // The excerpt is a different job. On a card, in `<meta>`, in JSON-LD and in a
  // share sheet the body is *not* adjacent, so falling back to its opening is
  // exactly right — that is what `buildSummary` is for.
  const summary = buildSummary(translation?.short_description, plainBody);
  const minutes = readingMinutes(plainBody);
  const published = formatArticleDate(article.$createdAt, locale);

  return (
    <>
      <NewsArticleSchema
        article={article}
        locale={locale}
        slug={slug}
        summary={summary}
        title={title}
      />

      <PageHeader
        breadcrumbs={[
          { label: tCommon("breadcrumbs.home"), href: "/" },
          { label: tNav("news"), href: "/news" },
          { label: title },
        ]}
        eyebrow={t("eyebrow")}
        lede={lead}
        meta={
          <>
            {article.sticky ? (
              <Pill tone="marker" uppercase>
                {t("featured")}
              </Pill>
            ) : null}
            <Pill tone="neutral">{published}</Pill>
            {article.campus?.name ? (
              <Pill tone="neutral">{article.campus.name}</Pill>
            ) : null}
            <Pill tone="neutral">{t("minutes", { minutes })}</Pill>
          </>
        }
        title={title}
      />

      <Section tone="paper">
        {article.image ? (
          <ChevronFrame className="mb-10 bg-surface-sunken" ratio="21/9">
            <Image
              alt=""
              height={540}
              priority
              sizes="(max-width: 1024px) 100vw, 1100px"
              src={article.image}
              width={1260}
            />
          </ChevronFrame>
        ) : null}

        <div className="grid gap-10 lg:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] lg:gap-16">
          {/* Below `lg` the rail is a horizontal strip under the headline;
              from `lg` it is the page's one persistent column. */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <dl className="flex flex-wrap gap-x-8 gap-y-3 border-edge border-t pt-5 lg:block lg:space-y-5">
              <RailRow label={t("published")} value={published} />
              <RailRow
                label={t("readingTime")}
                value={t("minutes", { minutes })}
              />
              {article.author ? (
                <RailRow label={t("writtenBy")} value={article.author} />
              ) : null}
              {article.campus?.name ? (
                <RailRow label={t("campus")} value={article.campus.name} />
              ) : null}
              {article.department?.Name ? (
                <RailRow label={t("unit")} value={article.department.Name} />
              ) : null}
            </dl>

            <div className="mt-6 lg:mt-8">
              <CopyLinkButton
                copiedLabel={t("linkCopied")}
                copyLabel={t("share")}
                shareTitle={title}
                track={{ event: "share", props: { type: "news" } }}
              />
            </div>
          </aside>

          <div className="min-w-0">
            <Prose>
              <PlateContentRenderer value={body || null} />
            </Prose>

            <Link
              className="mt-12 inline-flex items-center gap-2 text-ink-accent underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              href="/news"
            >
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />
              <span className="type-label">{t("backToNews")}</span>
            </Link>
          </div>
        </div>
      </Section>

      {related.length > 0 ? (
        <Section className="border-edge border-t" tone="paper">
          <SectionHeading seeAllHref="/news" seeAllLabel={t("relatedAction")}>
            {t("relatedTitle")}
          </SectionHeading>
          <CardGrid className="gap-x-6 gap-y-10">
            {related.map((entry) => (
              <RelatedArticle article={entry} key={entry.$id} locale={locale} />
            ))}
          </CardGrid>
        </Section>
      ) : null}
    </>
  );
}
