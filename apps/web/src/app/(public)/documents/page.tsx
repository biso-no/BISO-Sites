import { Suspense } from "react";
import { listPublishedDocuments } from "@/app/actions/documents";
import { DocumentsHero } from "@/components/documents/documents-hero";
import { DocumentsListClient } from "@/components/documents/documents-list-client";
import { getUserPreferences } from "@/lib/auth-utils";
import { resolveDocumentsFilters } from "@/lib/documents-filters";

export const metadata = {
  title: "Documents | BISO",
  description:
    "Access official BISO documents, bylaws, and guidelines that govern the BI Student Organisation.",
};

type SearchParams = Promise<{ campus?: string; category?: string }>;

// Reads the request (cookies, URL) inside the Suspense boundary so the hero
// above it can still be prerendered.
async function DocumentsList({ searchParams }: { searchParams: SearchParams }) {
  const [prefs, params] = await Promise.all([
    getUserPreferences(),
    searchParams,
  ]);
  // `?category=` and `?campus=` let other pages link to one shelf.
  const { campusId, category } = resolveDocumentsFilters(
    params,
    prefs?.campusId
  );
  const docs = await listPublishedDocuments({ campusId });
  return <DocumentsListClient documents={docs} initialCategory={category} />;
}

function DocumentsListSkeleton() {
  return (
    <div className="mx-auto max-w-7xl space-y-4 px-6 pb-20">
      {[...new Array(5)].map((_, i) => (
        <div
          className="h-32 w-full animate-pulse rounded-2xl"
          key={i}
          style={{ background: "rgba(255,255,255,0.04)" }}
        />
      ))}
    </div>
  );
}

export default function DocumentsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <div
      className="min-h-screen"
      style={{
        background:
          "linear-gradient(180deg, #001731 0%, #002147 50%, #001731 100%)",
      }}
    >
      <DocumentsHero />
      <Suspense fallback={<DocumentsListSkeleton />}>
        <DocumentsList searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
