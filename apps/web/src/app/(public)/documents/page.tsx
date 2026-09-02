import type { Documents } from "@repo/api/types/appwrite";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { listPublishedDocuments } from "@/app/actions/documents";
import { getLocale } from "@/app/actions/locale";
import { isKnownCategory } from "@/components/documents/v2/document-categories";
import { DocumentRow } from "@/components/documents/v2/document-row";
import { FilterChips } from "@/components/ui/filter-chips";
import { ListSkeleton } from "@/components/ui/loading-shell";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { getUserPreferences } from "@/lib/auth-utils";
import { resolveRequestCampus } from "@/lib/campus-scope";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("documents");
  return {
    // Campus-scoped view of the same list, not a competing one.
    alternates: { canonical: "/documents" },
    title: `${t("title")} | BISO`,
    description: t("intro"),
  };
}

interface DocumentsPageProps {
  searchParams: Promise<{ campus?: string; category?: string; q?: string }>;
}

function matchesSearch(doc: Documents, query: string): boolean {
  if (!query) {
    return true;
  }
  const needle = query.toLowerCase();
  return (
    doc.title.toLowerCase().includes(needle) ||
    (doc.description ?? "").toLowerCase().includes(needle)
  );
}

async function DocumentsList({
  campusId,
  category,
  query,
  searchParams,
}: {
  campusId: string | null;
  category: string;
  query: string;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const [t, locale, all] = await Promise.all([
    getTranslations("documents"),
    getLocale(),
    // The category filter is applied by the query, not in memory, so a
    // filtered view costs the same as the unfiltered one.
    listPublishedDocuments({ campusId }),
  ]);

  // Options come from the rows that exist. `FilterChips` renders nothing when
  // that leaves fewer than two, so an empty table shows no chip row rather
  // than furniture that filters nothing.
  const categories = [...new Set(all.map((d) => d.category))].sort();
  const options = [
    { value: "all", label: t("filter.all") },
    ...categories.map((value) => ({
      value,
      label: isKnownCategory(value) ? t(`categories.${value}`) : value,
      count: all.filter((d) => d.category === value).length,
    })),
  ];

  const rows = all
    .filter((d) => category === "all" || d.category === category)
    .filter((d) => matchesSearch(d, query));

  const labels = {
    category: (value: string) =>
      isKnownCategory(value) ? t(`categories.${value}`) : value,
    campus: t("row.campus"),
    download: t("row.download"),
    updated: t("row.updated"),
    view: t("row.view"),
  };

  return (
    <>
      <FilterChips
        active={category}
        basePath="/documents"
        className="mb-8"
        defaultValue="all"
        label={t("filter.label")}
        options={options}
        param="category"
        searchParams={searchParams}
      />

      {/* A plain GET form: the filtered view is a URL, and searching works
          with JavaScript disabled. The previous search box was `useState`
          inside a client list, so a search could not be linked or reloaded. */}
      <form action="/documents" className="mb-10 flex flex-wrap gap-3">
        {category === "all" ? null : (
          <input name="category" type="hidden" value={category} />
        )}
        <label className="min-w-0 flex-1" htmlFor="documents-search">
          <span className="sr-only">{t("search.label")}</span>
          <input
            className="type-body w-full rounded-biso-sm border border-edge bg-surface px-4 py-2 text-ink placeholder:text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            defaultValue={query}
            id="documents-search"
            name="q"
            placeholder={t("search.label")}
            type="search"
          />
        </label>
        <button
          className="type-body-sm rounded-biso-sm bg-action px-5 py-2 font-medium text-action-ink transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          type="submit"
        >
          {t("search.submit")}
        </button>
      </form>

      {rows.length > 0 ? (
        <ul className="border-edge border-t">
          {rows.map((doc) => (
            <DocumentRow
              doc={doc}
              key={doc.$id}
              labels={labels}
              locale={locale}
            />
          ))}
        </ul>
      ) : (
        <p className="type-body text-ink-muted">
          {all.length === 0 ? t("empty") : t("emptyFiltered")}
        </p>
      )}
    </>
  );
}

/**
 * Official BISO documents, backed by SharePoint.
 *
 * **PLACEHOLDER-014: the `documents` table holds zero published rows**, so the
 * empty state below is what this route actually serves today. The list, the
 * category chips and both actions per row are therefore unverified against
 * real data — the download route (`/api/documents/[id]/download`) and the
 * SharePoint link are untouched by this package.
 */
export default async function DocumentsPage({
  searchParams,
}: DocumentsPageProps) {
  const [sp, prefs, t, tCommon] = await Promise.all([
    searchParams,
    getUserPreferences(),
    getTranslations("documents"),
    getTranslations("common"),
  ]);

  // URL beats cookie beats "all", like every other campus-scoped route. The
  // list read the cookie alone, so a shared `/documents?campus=bergen` served
  // whatever campus the reader's own cookie held.
  const campusId = resolveRequestCampus(sp.campus, prefs?.campusId);
  if (campusId === undefined) {
    notFound();
  }

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: tCommon("breadcrumbs.home"), href: "/" },
          { label: t("title") },
        ]}
        lede={t("intro")}
        title={t("title")}
      />
      <Section tone="paper">
        <Suspense fallback={<ListSkeleton />}>
          <DocumentsList
            campusId={campusId}
            category={sp.category ?? "all"}
            query={sp.q ?? ""}
            searchParams={sp}
          />
        </Suspense>
      </Section>
    </>
  );
}
