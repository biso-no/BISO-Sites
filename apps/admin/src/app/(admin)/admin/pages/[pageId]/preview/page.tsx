import Link from "next/link";
import { notFound } from "next/navigation";
import type { Locale } from "@repo/api/types/appwrite";
import {
  getManagedPage,
  getPublishedPagePreview,
} from "@/app/actions/pages";
import { PageBuilderRenderer } from "@repo/editor/renderer";
import { DEFAULT_PAGE_DOCUMENT } from "@repo/editor/page-builder-config";
import type { PageBuilderDocument } from "@repo/editor/types";
import { Button } from "@repo/ui/components/ui/button";

const LOCALE_LABELS: Record<Locale, string> = {
  no: "Norwegian",
  en: "English",
};

function toDocument(document: PageBuilderDocument | null | undefined): PageBuilderDocument {
  if (!document) {
    return DEFAULT_PAGE_DOCUMENT;
  }

  return JSON.parse(JSON.stringify(document)) as PageBuilderDocument;
}

interface PreviewPageProps {
  params: { pageId: string };
  searchParams?: Record<string, string | string[] | undefined>;
}

export default async function PagePreviewRoute({
  params,
  searchParams,
}: PreviewPageProps) {
  const page = await getManagedPage(params.pageId);

  if (!page) {
    notFound();
  }

  const localeParam = typeof searchParams?.locale === "string" ? searchParams.locale : undefined;
  const resolvedLocale = (localeParam ?? page.translations[0]?.locale ?? "no") as Locale;
  const preview = page.slug
    ? await getPublishedPagePreview(page.slug, resolvedLocale, true)
    : null;

  const translation = preview?.translation ?? page.translations.find((item) => item.locale === resolvedLocale);

  if (!translation) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-muted px-6 py-12 text-center">
        <h1 className="text-2xl font-semibold text-primary-100">Translation missing</h1>
        <p className="max-w-lg text-sm text-muted-foreground">
          We couldn&apos;t find content for the selected locale. Head back to the editor and create a translation to preview it.
        </p>
        <Button asChild variant="outline">
          <Link href={`/admin/pages/${page.id}`}>Return to editor</Link>
        </Button>
      </div>
    );
  }

  const document = toDocument(preview?.document ?? translation.draftDocument ?? translation.publishedDocument);
  const isPublished = preview?.translation?.isPublished ?? translation.isPublished;

  return (
    <div className="min-h-screen bg-muted py-10">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6">
        <header className="flex flex-col gap-4 rounded-lg border border-primary/10 bg-white/90 p-6 shadow-sm">
          <div className="space-y-1">
            <p className="text-sm font-medium text-primary-60">Previewing</p>
            <h1 className="text-3xl font-semibold text-primary-100">{page.title || "Untitled page"}</h1>
            <p className="text-sm text-muted-foreground">
              {LOCALE_LABELS[resolvedLocale]} · {isPublished ? "Published" : "Draft"}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="sm" variant="outline">
              <Link href={`/admin/pages/${page.id}`}>Back to editor</Link>
            </Button>
            {page.slug ? (
              <Button asChild size="sm" variant="ghost">
                <Link href={`/${page.slug}`}>Open live page</Link>
              </Button>
            ) : null}
          </div>
        </header>
        <div className="rounded-lg border border-primary/10 bg-white p-6 shadow-sm">
          <PageBuilderRenderer data={document} />
        </div>
      </div>
    </div>
  );
}
