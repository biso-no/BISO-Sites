import type { Locale } from "@repo/api/types/appwrite";
import { PageRender } from "@repo/editor/render";
import { notFound } from "next/navigation";
import { getLocale } from "@/app/actions/locale";
import { getPublicPage } from "@/app/actions/pages";

type PageProps = {
  params: Promise<{
    slug: string[];
  }>;
};

export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  const path = slug.join("/");
  const locale = await getLocale();

  const pageData = await getPublicPage(path, locale as Locale);
  

  console.log("Page data:", pageData);

  if (!pageData) {
    notFound();
  }

  return (
    <main>
      <PageRender data={pageData} />
    </main>
  );
}
