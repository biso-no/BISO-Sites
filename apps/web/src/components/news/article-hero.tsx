import type { News } from "@repo/api/types/appwrite";
import { ImageWithFallback } from "@repo/ui/components/image";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

interface ArticleHeroProps {
  article: News;
  lead: string;
  title: string;
}

// A hero photo that 404s should leave the brand field showing, not the broken
// -image glyph `ImageWithFallback` defaults to and `object-cover` would stretch.
const TRANSPARENT_PIXEL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

/**
 * The hero sizes itself from its content rather than from the viewport, so a
 * three-line headline never crops and a one-line headline never leaves a void.
 * Top padding clears the fixed `h-20` nav, which is transparent until scroll.
 */
export async function ArticleHero({ article, title, lead }: ArticleHeroProps) {
  const t = await getTranslations("news.article");
  const image = article.image;

  return (
    <header className="relative isolate overflow-hidden bg-brand-dark">
      {/* The brand field is the hero's ground: it carries the whole header when
          an article has no photo, and shows through when one fails to load. */}
      <div className="absolute inset-0 bg-linear-to-br from-brand-overlay-from via-brand-overlay-via to-brand-overlay-to" />

      {image ? (
        <ImageWithFallback
          alt=""
          className="object-cover"
          fallbackSrc={TRANSPARENT_PIXEL}
          fill
          priority
          sizes="100vw"
          src={image}
        />
      ) : null}

      {/* Two scrims rather than one flat wash: dense where the type sits,
          clearing toward the top right so a photograph still reads as one. */}
      <div className="absolute inset-0 bg-linear-to-t from-brand-dark via-brand-dark/70 to-brand-dark/15" />
      <div className="absolute inset-0 bg-linear-to-r from-brand-dark/75 via-brand-dark/25 to-transparent" />

      <div className="relative mx-auto max-w-6xl px-4 pt-28 pb-28 sm:px-6 lg:px-8 lg:pt-36 lg:pb-36">
        <Link
          className="inline-flex items-center gap-2 rounded-full text-sm text-white/80 transition-colors hover:text-brand focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-4"
          href="/news"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          {t("backToNews")}
        </Link>

        <div className="mt-8 max-w-3xl">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 font-semibold text-[0.7rem] uppercase tracking-[0.2em]">
            <span className="rounded-full bg-brand px-3 py-1 text-brand-foreground">
              {t("eyebrow")}
            </span>
            {article.campus?.name ? (
              <span className="text-white/70">{article.campus.name}</span>
            ) : null}
            {article.department?.Name ? (
              <span className="text-white/70">{article.department.Name}</span>
            ) : null}
          </div>

          <h1 className="mt-6 text-balance font-bold text-4xl text-white leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            {title}
          </h1>

          {lead ? (
            <p className="mt-6 max-w-2xl text-pretty text-lg text-white/80 leading-relaxed sm:text-xl">
              {lead}
            </p>
          ) : null}
        </div>
      </div>
    </header>
  );
}
