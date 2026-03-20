import { getRenderableContentEntryByPath } from "@repo/api/editorial";
import type { Locale } from "@repo/api/types/appwrite";
import { EditorialContentView } from "@repo/editor/editorial";
import { PageRender } from "@repo/editor/render";
import { notFound } from "next/navigation";
import { getLocale } from "@/app/actions/locale";
import { getPublicPage } from "@/app/actions/pages";
import { getAuthStatus } from "@/lib/auth-utils";

type PageProps = {
  params: Promise<{
    slug: string[];
  }>;
};

export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  const path = slug.join("/");
  const locale = await getLocale();
  const authStatus = await getAuthStatus();

  const editorialEntry = await getRenderableContentEntryByPath({
    path,
    locale: locale as Locale,
  });

  if (editorialEntry) {
    return (
      <main>
        <EditorialContentView
          entry={editorialEntry.entry}
          locale={editorialEntry.locale}
          version={editorialEntry.version}
          viewerIsAuthenticated={!!authStatus.isAuthenticated}
        />
      </main>
    );
  }

  const pageData = await getPublicPage(path, locale as Locale);

  if (!pageData) {
    notFound();
  }

  return (
    <main>
      <PageRender data={pageData.document} />
    </main>
  );
}
