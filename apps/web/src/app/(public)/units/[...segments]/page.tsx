import {
  projectPageSlug,
  projectSlugForUnit,
} from "@repo/shared/utils/project-units";
import { unitDisplayName } from "@repo/shared/utils/unit-names";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { Suspense } from "react";
import { getLocale } from "@/app/actions/locale";
import { PageThemeStyle } from "@/components/page-theme-style";
import { cachedPublishedPage } from "@/lib/data/public-content";
import { cachedUnitDetail } from "@/lib/data/units";
import { resolvePageTheme } from "@/lib/page-theme";
import {
  isRenderablePage,
  renderPublishedEditorPage,
} from "@/lib/published-editor-page";
import { publishedUnitPage } from "@/lib/unit-page";
import { CampusChooser } from "./_components/campus-chooser";
import { UnitView } from "./_components/unit-view";
import DepartmentLoading from "./loading";
import { resolveUnit } from "./resolve";

interface Props {
  params: Promise<{ segments: string[] }>;
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

/** Campus "5" (National): the unit URLs a project's own page replaces. */
const NATIONAL_CAMPUS_ID = "5";

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
      <CampusChooser
        matches={resolution.matches}
        slug={resolution.slug}
        unavailableAt={resolution.unavailableAt}
      />
    );
  }

  const locale = await getLocale();
  const { department, canonical } = resolution;

  // C3: a national project unit's URL belongs to the project's own page once
  // one is published at `projects/<project>`. A failed read leaves the unit
  // page in place. Decided here, before any Suspense boundary, like every
  // other redirect.
  const project =
    department.campus_id === NATIONAL_CAMPUS_ID
      ? projectSlugForUnit(department.slug)
      : null;
  if (project) {
    const projectPage = await cachedPublishedPage(
      projectPageSlug(project),
      locale
    ).catch(() => null);
    if (isRenderablePage(projectPage)) {
      permanentRedirect(`/projects/${project}`);
    }
  }

  // A published custom page overrides the default view. canonical is
  // "/units/<campus>/<slug>"; the page's storage slug is the same without the
  // leading slash. A null canonical means the department has no slug, and the
  // slug IS the page binding — no page can exist, so skip the lookup rather
  // than querying a bogus key.
  const rawPageResult = canonical
    ? await cachedPublishedPage(canonical.slice(1), locale).catch(() => null)
    : null;
  const pageResult = publishedUnitPage(rawPageResult, department.$id);

  // The department's theme covers its custom page and its coded default view
  // alike. Rendered first, before any Suspense boundary, so it ships in the
  // first flush with the nav.
  const departmentTheme = {
    theme_accent: department.theme_accent ?? null,
    theme_dark: department.theme_dark ?? null,
  };

  if (rawPageResult && pageResult) {
    return renderPublishedEditorPage({
      departmentTheme,
      locale,
      result: rawPageResult,
      slug: canonical?.slice(1) ?? "",
      stream: {
        fallback: <DepartmentLoading />,
        frame: (body) => <div className="min-h-screen bg-surface">{body}</div>,
      },
    });
  }

  const theme = resolvePageTheme({
    departmentId: department.$id,
    departmentTheme,
    docTheme: null,
  });

  // Resolved (and any notFound()) before the boundary below: the auto-source
  // feed streaming above is safe to defer because it never decides the
  // response status, but "does this department's page exist at all" must.
  // `cachedUnitDetail` returns null for a missing row, an inactive one, AND
  // one the public visibility rule excludes (an operating ledger, a national
  // governance body) — so a 24SO account that is not a student unit has no
  // public page at all. It THROWS on a transient read failure rather than
  // reporting a false absence, precisely so this notFound() is never reached
  // (and cached) because Appwrite happened to time out.
  const unit = await cachedUnitDetail(department.$id, locale);
  if (!unit) {
    notFound();
  }

  return (
    <>
      <PageThemeStyle theme={theme} />
      <Suspense fallback={<DepartmentLoading />}>
        <UnitView locale={locale} unit={unit} />
      </Suspense>
    </>
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { segments } = await params;
  const resolution = await resolveUnit(segments);

  if (resolution.kind === "chooser") {
    // Still real content a crawler can land on directly — give it a title
    // and keep it out of the index, since the canonical destination is
    // whichever campus-explicit URL the visitor actually picks. The display
    // name, not the campus-prefixed accounting `Name`.
    const name = resolution.matches[0]?.Name;
    const title = name ? unitDisplayName(name) : resolution.slug;
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

  // `cachedUnitDetail` costs two reads; only pay for it when the published
  // page didn't already supply both fields. It is the same cache entry the
  // body reads, so this is at worst one extra hit.
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
