import type { SearchHit } from "@repo/shared/search/response";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Pill } from "@/components/ui/pill";
import { Highlighted } from "./highlighted";
import { HitLead } from "./hit-lead";
import { formatSeconds, hitMeta, intlLocaleOf, productMeta } from "./hit-meta";

const SITE_HOST = "biso.no";
const PATH_END = /[?#]/;

/** "biso.no / projects / winter-games": the real path, not a prettified one. */
function breadcrumbOf(url: string): string {
  const segments = url.split(PATH_END)[0].split("/").filter(Boolean);
  return [SITE_HOST, ...segments].join(" / ");
}

/**
 * One result: lead visual, title, a meta line, a snippet, and on the right the
 * fact a visitor scans for (price, deadline, stock). A row, not a card.
 */
export function SearchResultRow({
  hit,
  locale,
  campusId = null,
}: {
  hit: SearchHit;
  locale: "no" | "en";
  /** The visitor's study campus, to mark results from it. */
  campusId?: string | null;
}) {
  const t = useTranslations("search");
  const intl = intlLocaleOf(locale);
  const isDocument = hit.group === "page" && hit.type === "document";
  const showsPath = hit.group === "page" && !isDocument;
  const ownCampus = campusId !== null && hit.campus_id === campusId;

  let metaText = "";
  if (hit.group === "job") {
    metaText = hit.department ?? "";
  } else if (hit.group !== "product" && !showsPath) {
    metaText = hitMeta(hit, intl, t);
  }

  let aside: string | null = null;
  if (hit.group === "job") {
    const deadline = formatSeconds(
      hit.deadline,
      { day: "numeric", month: "short" },
      intl
    );
    aside = deadline ? t("meta.applyBy", { date: deadline }) : null;
  } else if (hit.group === "product") {
    aside = [
      productMeta(hit, intl, t),
      hit.in_stock === true ? t("meta.inStock") : null,
    ]
      .filter(Boolean)
      .join(" · ");
  }

  return (
    <li className="flex items-start gap-4 border-edge border-b py-5">
      <HitLead hit={hit} locale={intl} size="small" />
      <div className="min-w-0 flex-1">
        <h3 className="type-heading-card text-ink">
          <Link
            className="underline-offset-4 hover:underline focus-visible:rounded-biso-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            href={hit.url}
          >
            <Highlighted segments={hit.title} />
          </Link>
        </h3>
        <p className="type-body-sm mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-ink-muted">
          <span className="font-semibold">{t(`groups.${hit.group}`)}</span>
          {ownCampus ? <Pill tone="accent">{hit.campus_name}</Pill> : null}
          {metaText ? <span>{metaText}</span> : null}
        </p>
        {showsPath ? (
          <p className="type-body-sm mt-1 break-words text-ink-muted">
            {breadcrumbOf(hit.url)}
          </p>
        ) : null}
        {hit.snippet.length > 0 ? (
          <p className="type-body-sm mt-2 text-ink">
            <Highlighted segments={hit.snippet} />
          </p>
        ) : null}
      </div>
      {aside ? (
        <p className="type-body-sm max-w-[10rem] shrink-0 text-end font-semibold text-ink">
          {aside}
        </p>
      ) : null}
    </li>
  );
}
