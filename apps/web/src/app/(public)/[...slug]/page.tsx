import type { Locale } from "@repo/api/types/appwrite";
import dynamic from "next/dynamic";
import { notFound } from "next/navigation";
import { getLocale } from "@/app/actions/locale";
import { getDemoPage } from "@/app/actions/pages";

const PageRender = dynamic(() => import("@repo/editor").then((mod) => mod.PageRender), {
  ssr: false,
});

type PageProps = {
  params: Promise<{
    slug: string[];
  }>;
};

export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  const path = slug.join("/");
  const locale = await getLocale();

  const pageData = await getDemoPage(path, locale as Locale);

  if (!pageData) {
    notFound();
  }

  // Cast the document to Data type for Puck
  const data =
    typeof pageData.puck_document === "string"
      ? JSON.parse(pageData.puck_document)
      : pageData.puck_document;

  return (
    <main>
      <PageRender data={data} />
    </main>
  );
}
