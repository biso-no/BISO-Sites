import { Locale } from "@repo/api/types/appwrite";
import { EditorialContentView } from "@repo/editor/editorial";
import { notFound } from "next/navigation";
import { getManagedContentEntry } from "@/app/actions/editorial";

export const dynamic = "force-dynamic";

type PreviewPageProps = {
  params: Promise<{
    entryId: string;
  }>;
  searchParams: Promise<{
    locale?: string;
  }>;
};

export default async function ContentEntryPreviewPage({
  params,
  searchParams,
}: PreviewPageProps) {
  const [{ entryId }, { locale }] = await Promise.all([params, searchParams]);
  const result = await getManagedContentEntry(entryId);

  if (!result?.template?.publishedVersion) {
    notFound();
  }

  const targetLocale =
    locale === Locale.EN
      ? Locale.EN
      : locale === Locale.NO
        ? Locale.NO
        : result.entry.sourceLocale;
  const localeRecord =
    result.entry.locales.find(
      (entryLocale) => entryLocale.locale === targetLocale
    ) ??
    result.entry.locales.find(
      (entryLocale) => entryLocale.locale === result.entry.sourceLocale
    ) ??
    result.entry.locales[0];

  if (!localeRecord) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-background">
      <EditorialContentView
        entry={result.entry}
        locale={localeRecord}
        version={result.template.publishedVersion}
        viewerIsAuthenticated
      />
    </main>
  );
}
