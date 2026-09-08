import type { PageDoc } from "@repo/editor";
import type { Locale } from "@repo/i18n/config";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { Suspense } from "react";
import { getLocale } from "@/app/actions/locale";
import { resolvePageFeeds } from "@/lib/data/page-feeds";
import { cachedPublishedPage } from "@/lib/data/public-content";
import { cachedUnitDetail } from "@/lib/data/units";
import { RenderedPage } from "../../[...slug]/_components/rendered-page";
import { CampusChooser } from "./_components/campus-chooser";
import { UnitView } from "./_components/unit-view";
import DepartmentLoading from "./loading";
import { resolveUnit } from "./resolve";

interface Props {
  params: Promise<{ segments: string[] }>;
}

/**
 * The slug is the binding between a department and its custom page — but the
 * slug is reusable (a page can predate the `units/` namespace guard, or sit
 * there with a null `department_id`), so a page found at the canonical slug
 * is only genuinely *this* department's page if its `department_id` says so.
 * A null `department_id` must never match: it means "no department", not
 * "any department".
 */
function pageBelongsToDepartment(
  pageDepartmentId: string | null | undefined,
  departmentId: string
): boolean {
  return pageDepartmentId != null && pageDepartmentId === departmentId;
}

type PageLookupResult = Awaited<ReturnType<typeof cachedPublishedPage>>;

/**
 * The single predicate for "this lookup is genuinely this department's
 * PUBLISHED custom page" — a published translation, a document to render,
 * and ownership. The page body and generateMetadata MUST share this exact
 * predicate, or they can disagree about what the page is.
 *
 * That disagreement is reachable, not theoretical: both `pages` and
 * `page_translations` are `rowSecurity: false` with table-level `read("any")`
 * (packages/api/appwrite.config.json), so the per-row permissions the publish
 * flow computes are NOT enforced — a guest client can read an unpublished
 * draft row. `getPage` (via `cachedPublishedPage`) falls back to
 * `draft_document` when there is no published document, so checking
 * ownership alone (as generateMetadata used to) let a department whose `en`
 * locale has only an unpublished draft leak that draft's title/description
 * into `<head>` while the body correctly fell back to the default department
 * view.
 */
function publishedUnitPage(
  pageResult: PageLookupResult,
  departmentId: string
): PageLookupResult {
  if (
    pageResult?.translation?.is_published &&
    pageResult.doc &&
    pageBelongsToDepartment(pageResult.row.department_id, departmentId)
  ) {
    return pageResult;
  }
  return null;
}

/**
 * Opt out of the instant shell, for the reason documented on the (public)
 * catch-all: once the shell flushes, the response is committed as 200 and
 * notFound() can no longer answer a crawler with a real 404. That is also why
 * resolution and every notFound()/permanentRedirect() call below run directly
 * in the page body, before any <Suspense> boundary — a boundary is exactly
 * the same trap: its fallback can flush as the committed 200 before a
 * notFound() buried in the suspended subtree ever runs. Suspense only wraps
 * the tail end of each branch, once no further notFound()/redirect decision
 * remains, purely to stream in content that cannot change the response
 * status.
 */
export const instant = false;

async function PublishedUnit({
  doc,
  locale,
}: {
  doc: PageDoc;
  locale: Locale;
}) {
  const feeds = await resolvePageFeeds(doc, locale);
  return <RenderedPage doc={doc} feeds={feeds} locale={locale} />;
}

export default async function UnitPage({ params }: Props) {
  const { segments } = await params;
  const resolution = await resolveUnit(segments);

  if (resolution.kind === "notFound") {
    notFound();
  }
  if (resolution.kind === "redirect") {
    permanentRedirect(resolution.to);
  }
  if (resolution.kind === "chooser") {
    return (
      <div className="min-h-screen bg-background">
        <CampusChooser
          matches={resolution.matches}
          slug={resolution.slug}
          unavailableAt={resolution.unavailableAt}
        />
      </div>
    );
  }

  const locale = await getLocale();
  const { department, canonical } = resolution;

  // A published custom page overrides the default view. canonical is
  // "/units/<campus>/<slug>"; the page's storage slug is the same without the
  // leading slash. A null canonical means the department has no slug, and the
  // slug IS the page binding — no page can exist, so skip the lookup rather
  // than querying a bogus key.
  const rawPageResult = canonical
    ? await cachedPublishedPage(canonical.slice(1), locale).catch(() => null)
    : null;
  const pageResult = publishedUnitPage(rawPageResult, department.$id);

  if (pageResult) {
    const doc = pageResult.doc as PageDoc;
    return (
      <div className="min-h-screen bg-background">
        <Suspense fallback={<DepartmentLoading />}>
          <PublishedUnit doc={doc} locale={locale} />
        </Suspense>
      </div>
    );
  }

  // Resolved (and any notFound()) before the boundary below: the auto-source
  // feed streaming above is safe to defer because it never decides the
  // response status, but "does this department's page exist at all" must.
  // `cachedUnitDetail` returns null for an inactive row AND for one the public
  // visibility rule excludes (an operating ledger, a national governance body),
  // so a 24SO account that is not a student unit has no public page at all.
  const unit = await cachedUnitDetail(department.$id, locale);
  if (!unit) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-section to-background">
      <Suspense fallback={<DepartmentLoading />}>
        <UnitView locale={locale} unit={unit} />
      </Suspense>
    </div>
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { segments } = await params;
  const resolution = await resolveUnit(segments);

  if (resolution.kind === "chooser") {
    // Still real content a crawler can land on directly — give it a title
    // and keep it out of the index, since the canonical destination is
    // whichever campus-explicit URL the visitor actually picks.
    const title = resolution.matches[0]?.Name ?? resolution.slug;
    return {
      title: `${title} | BISO`,
      robots: { index: false },
    };
  }
  if (resolution.kind !== "department") {
    return {};
  }

  const locale = await getLocale();
  const { department, canonical } = resolution;
  const rawPageResult = canonical
    ? await cachedPublishedPage(canonical.slice(1), locale).catch(() => null)
    : null;
  // Same predicate as the page body (see publishedUnitPage): a page sitting
  // at this slug that isn't published, has no document, or doesn't belong to
  // this department must not supply its title/description, or the metadata
  // could describe content the body doesn't render.
  const pageResult = publishedUnitPage(rawPageResult, department.$id);

  // `cachedUnitDetail` fans out to three reads; only pay for it when the
  // published page didn't already supply both fields. It is the same cache
  // entry the body reads, so this is at worst one extra hit.
  const needsFallback = !(
    pageResult?.translation?.title && pageResult?.translation?.description
  );
  const unit = needsFallback
    ? await cachedUnitDetail(department.$id, locale)
    : null;

  // `unit.name` — the display projection — not `department.Name`: a tab title
  // and a search result should read "Fadderullan", not "OSL Fadderullan".
  const title = pageResult?.translation?.title ?? unit?.name ?? department.Name;
  const description =
    pageResult?.translation?.description || unit?.summary || undefined;

  return {
    title: `${title} | BISO`,
    description: description?.slice(0, 160),
    // The one-segment URL points at the campus-explicit one so the two routes
    // never compete as duplicate content. A not-yet-slugged department has no
    // campus-explicit URL at all, so it advertises no canonical rather than an
    // empty <link rel="canonical">.
    ...(canonical ? { alternates: { canonical } } : {}),
  };
}
