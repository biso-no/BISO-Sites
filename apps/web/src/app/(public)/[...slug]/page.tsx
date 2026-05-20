import { getPage } from "@repo/api/page-builder";
import type { PageDoc } from "@repo/editor";
import { notFound } from "next/navigation";
import { RenderedPage } from "./_components/rendered-page";

interface Props {
  params: Promise<{ slug?: string[] }>;
}

export default async function DynamicPage({ params }: Props) {
  const { slug: segments } = await params;

  // Root path is handled by (public)/page.tsx; catch-all only fires for non-root
  if (!segments || segments.length === 0) {
    notFound();
  }

  const slug = segments.join("/");
  console.log(slug);
  const result = await getPage(slug, "no");
  console.log("Result: ", result);

  if (!(result?.translation?.is_published && result.doc)) {
    notFound();
  }

  return <RenderedPage doc={result.doc as PageDoc} />;
}
