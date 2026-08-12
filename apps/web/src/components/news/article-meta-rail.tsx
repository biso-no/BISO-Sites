import { CalendarDays, Clock, PenLine } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ArticleShare } from "./article-share";

interface ArticleMetaRailProps {
  articleId: string;
  author?: string | null;
  lead: string;
  minutes: number;
  publishedOn: string;
  title: string;
}

/**
 * The dateline. Every row in it is a fact about this article, never decoration.
 * On phones it collapses to a single icon-led line so the story starts near the
 * top of the card; from `lg` it becomes the page's one persistent column.
 */
export async function ArticleMetaRail({
  articleId,
  author,
  lead,
  minutes,
  publishedOn,
  title,
}: ArticleMetaRailProps) {
  const t = await getTranslations("news.article");

  const entries = [
    { icon: CalendarDays, label: t("published"), value: publishedOn },
    { icon: Clock, label: t("readingTime"), value: t("minutes", { minutes }) },
    ...(author
      ? [{ icon: PenLine, label: t("writtenBy"), value: author }]
      : []),
  ];

  return (
    <aside className="lg:sticky lg:top-28 lg:self-start">
      <div className="border-brand-accent border-t-2 pt-5 lg:pt-6">
        <dl className="flex flex-wrap items-center gap-x-5 gap-y-2 lg:block lg:space-y-6">
          {entries.map(({ icon: Icon, label, value }) => (
            <div className="flex items-center gap-2 lg:block" key={label}>
              <dt className="flex items-center gap-2 font-semibold text-[0.68rem] text-muted-foreground uppercase tracking-[0.16em]">
                <Icon aria-hidden="true" className="h-3.5 w-3.5 text-brand" />
                <span className="sr-only lg:not-sr-only">{label}</span>
              </dt>
              <dd className="font-medium text-foreground text-sm lg:mt-1.5">
                {value}
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-6 max-w-xs lg:mt-8 lg:max-w-none">
          <ArticleShare articleId={articleId} lead={lead} title={title} />
        </div>
      </div>
    </aside>
  );
}
