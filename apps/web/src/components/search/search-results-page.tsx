import {
  type PageSearchResponse,
  SEARCH_GROUPS,
} from "@repo/shared/search/response";
import { campusIdToLabel } from "@repo/shared/utils/unit-urls";
import { cn } from "@repo/ui/lib/utils";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { FilterChips } from "@/components/ui/filter-chips";
import { Section } from "@/components/ui/section";
import {
  StatusPanel,
  statusPanelPrimaryAction,
  statusPanelSecondaryAction,
} from "@/components/ui/status-panel";
import {
  type SearchPageParams,
  searchPageHref,
} from "@/lib/search/page-params";
import { SearchPageForm } from "./search-page-form";
import { SearchResultRow } from "./search-result-row";

const STUDY_CAMPUSES = new Set(["1", "2", "3", "4"]);
const PAGER_LINK =
  "type-label rounded-biso-pill border border-edge px-5 py-2.5 text-ink transition-colors hover:border-ink-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

function Shortcuts({
  className,
  links,
}: {
  className: string;
  links: { href: string; label: string }[];
}) {
  return (
    <>
      {links.map((link) => (
        <Link className={className} href={link.href} key={link.href}>
          {link.label}
        </Link>
      ))}
    </>
  );
}

function CampusSwitch({
  href,
  label,
  on,
}: {
  href: string;
  label: string;
  on: boolean;
}) {
  return (
    <Link
      aria-pressed={on}
      className="type-body-sm inline-flex items-center gap-3 rounded-biso-pill focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
      href={href}
      role="button"
    >
      <span
        aria-hidden="true"
        className={cn(
          "relative h-6 w-10 rounded-biso-pill border border-edge",
          on ? "bg-action" : "bg-transparent"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-4 rounded-biso-pill",
            on ? "start-5 bg-action-ink" : "start-0.5 bg-ink-muted"
          )}
        />
      </span>
      <span className="text-ink">{label}</span>
    </Link>
  );
}

function Pager({
  params,
  response,
}: {
  params: SearchPageParams;
  response: PageSearchResponse;
}) {
  const t = useTranslations("search");
  if (response.total_pages <= 1) {
    return null;
  }
  const { q, group, onlyCampus } = params;
  const hrefTo = (page: number) =>
    searchPageHref({ q, group, onlyCampus, page });
  return (
    <nav
      aria-label={t("page.pagination")}
      className="mt-8 flex flex-wrap items-center gap-4"
    >
      {response.page > 1 ? (
        <Link
          className={PAGER_LINK}
          href={hrefTo(response.page - 1)}
          rel="prev"
        >
          {t("page.previous")}
        </Link>
      ) : null}
      <span className="type-body-sm text-ink-muted">
        {t("page.pageOf", { page: response.page, total: response.total_pages })}
      </span>
      {response.page < response.total_pages ? (
        <Link
          className={PAGER_LINK}
          href={hrefTo(response.page + 1)}
          rel="next"
        >
          {t("page.next")}
        </Link>
      ) : null}
    </nav>
  );
}

/**
 * The `/search` page as markup from props: the navy band with the form, the
 * filters, the rows and the pager. Data fetching lives in the route, so this
 * renders the same for a result, an empty answer and an outage.
 */
export function SearchResultsPage({
  campusId,
  error,
  locale,
  params,
  response,
}: {
  /** The visitor's campus id; only a study campus ("1"-"4") enables the switch. */
  campusId: string | null;
  error: boolean;
  locale: "no" | "en";
  params: SearchPageParams;
  response: PageSearchResponse | null;
}) {
  const t = useTranslations("search");
  const { q, group, onlyCampus } = params;
  const studyCampus =
    campusId !== null && STUDY_CAMPUSES.has(campusId) ? campusId : null;
  const campusLabel = campusIdToLabel(studyCampus);
  const links = [
    { href: "/events", label: t("shortcuts.events") },
    { href: "/jobs", label: t("shortcuts.jobs") },
    { href: "/shop", label: t("shortcuts.shop") },
  ];

  const hidden: Record<string, string> = {};
  if (group) {
    hidden.type = group;
  }
  if (onlyCampus) {
    hidden.only = "1";
  }

  const chipParams: Record<string, string> = { q };
  if (onlyCampus) {
    chipParams.only = "1";
  }
  const totalAll = response
    ? SEARCH_GROUPS.reduce((sum, key) => sum + response.counts[key], 0)
    : 0;
  const options = response
    ? [
        { value: "all", label: t("page.all"), count: totalAll },
        ...SEARCH_GROUPS.filter(
          (key) => response.counts[key] > 0 || key === group
        ).map((key) => ({
          value: key,
          label: t(`groups.${key}`),
          count: response.counts[key],
        })),
      ]
    : [];

  const hasResults = response !== null && response.total > 0;

  return (
    <>
      <Section clearNav tone="deep">
        <h1 className="type-display-lg text-ink">{t("page.title")}</h1>
        <SearchPageForm
          defaultValue={q}
          hidden={hidden}
          label={t("field.label")}
          placeholder={t("field.placeholder")}
          submitLabel={t("submit")}
        />
        {response && q ? (
          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
            <p aria-live="polite" className="type-body text-ink-muted">
              {t("resultsCount", { count: response.total })}
            </p>
            {campusLabel ? (
              <CampusSwitch
                href={searchPageHref({ q, group, onlyCampus: !onlyCampus })}
                label={t("page.onlyCampus", { campus: campusLabel })}
                on={onlyCampus}
              />
            ) : null}
          </div>
        ) : null}
      </Section>

      {q ? null : (
        <Section tone="paper" width="prose">
          <h2 className="type-label text-ink-muted">{t("shortcuts.title")}</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            <Shortcuts className={statusPanelSecondaryAction} links={links} />
          </div>
        </Section>
      )}

      {error ? (
        <StatusPanel
          actions={
            <Link
              className={statusPanelPrimaryAction}
              href={searchPageHref({ q, group, onlyCampus })}
            >
              {t("error.link")}
            </Link>
          }
          body={t("error.body")}
          title={t("error.title")}
        />
      ) : null}

      {q && response && !hasResults ? (
        <StatusPanel
          actions={
            <>
              <span className="type-body-sm basis-full text-ink-muted">
                {t("empty.links")}
              </span>
              <Shortcuts className={statusPanelSecondaryAction} links={links} />
            </>
          }
          body={t("empty.body")}
          title={t("empty.title", { query: q })}
        />
      ) : null}

      {response && hasResults ? (
        <Section tone="paper">
          <FilterChips
            active={group ?? "all"}
            basePath="/search"
            label={t("page.filterLabel")}
            options={options}
            param="type"
            searchParams={chipParams}
          />
          <ul className="mt-4 border-edge border-t">
            {response.hits.map((hit) => (
              <SearchResultRow
                campusId={studyCampus}
                hit={hit}
                key={hit.row_id}
                locale={locale}
              />
            ))}
          </ul>
          <Pager params={params} response={response} />
        </Section>
      ) : null}
    </>
  );
}
