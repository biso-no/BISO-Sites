import { getPage } from "@repo/api/page-builder";
import type { PageDoc } from "@repo/editor";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale } from "@/app/actions/locale";
import { RenderedPage } from "./_components/rendered-page";

interface Props {
  params: Promise<{ slug?: string[] }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug: segments } = await params;
  if (!segments || segments.length === 0) {
    return {};
  }
  try {
    const slug = segments.join("/");
    const locale = await getLocale();
    const result = await getPage(slug, locale);
    const title = result?.translation?.title;
    const description = result?.translation?.description ?? undefined;
    if (!title) {
      return {};
    }
    return {
      title: `${title} | BISO`,
      description: description?.slice(0, 160),
    };
  } catch {
    return {};
  }
}

export default async function DynamicPage({ params }: Props) {
  const { slug: segments } = await params;

  // Root path is handled by (public)/page.tsx; catch-all only fires for non-root
  if (!segments || segments.length === 0) {
    notFound();
  }

  const slug = segments.join("/");
  const locale = await getLocale();
  const result = await getPage(slug, locale);

  if (!(result?.translation?.is_published && result.doc)) {
    notFound();
  }

  return <RenderedPage doc={result.doc as PageDoc} />;
}
