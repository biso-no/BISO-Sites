import { Suspense } from "react";
import { listPublishedDocuments } from "@/app/actions/documents";
import { DocumentsHero } from "@/components/documents/documents-hero";
import { DocumentsListClient } from "@/components/documents/documents-list-client";
import { getUserPreferences } from "@/lib/auth-utils";

export const metadata = {
  title: "Documents | BISO",
  description:
    "Access official BISO documents, bylaws, and guidelines that govern the BI Student Organisation.",
};

async function DocumentsList({ campusId }: { campusId: string | null }) {
  const docs = await listPublishedDocuments({ campusId });
  return <DocumentsListClient documents={docs} />;
}

function DocumentsListSkeleton() {
  return (
    <div className="mx-auto max-w-7xl space-y-4 px-6 pb-20">
      {[...Array(5)].map((_, i) => (
        <div
          className="h-32 w-full animate-pulse rounded-2xl"
          key={i}
          style={{ background: "rgba(255,255,255,0.04)" }}
        />
      ))}
    </div>
  );
}

export default async function DocumentsPage() {
  const prefs = await getUserPreferences();
  const campusId = prefs?.campusId ?? null;

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
        <DocumentsList campusId={campusId} />
      </Suspense>
    </div>
  );
}
