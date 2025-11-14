import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { Locale } from "@repo/api/types/appwrite";
import { getLocale } from "@/app/actions/locale";
import { getPublicPage, getPublicPagePreview } from "@/app/actions/pages";
import { DEFAULT_PAGE_DOCUMENT } from "@repo/editor";
import { PageBuilderRenderer } from "@repo/editor/renderer";
import type { PageBuilderDocument } from "@repo/editor/types";
import { isLocale } from "@/i18n/config";

interface PageBuilderRouteProps {
  params: { slug?: string[] };
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function toDocument(document: PageBuilderDocument | null | undefined): PageBuilderDocument {
  if (!document) {
    return DEFAULT_PAGE_DOCUMENT;
  }

  return JSON.parse(JSON.stringify(document)) as PageBuilderDocument;
}

async function resolveLocale(searchParams?: Record<string, string | string[] | undefined>): Promise<Locale> {
  const queryLocale = typeof searchParams?.locale === "string" ? searchParams.locale : undefined;
  const baseLocale = await getLocale();

  if (queryLocale && isLocale(queryLocale)) {
    return queryLocale as Locale;
  }

  return baseLocale as Locale;
}

function joinSlug(segments: string[] | undefined): string {
  if (!segments || segments.length === 0) {
    return "";
  }

  return segments.map((segment) => decodeURIComponent(segment)).join("/");
}

export async function generateMetadata({ params }: PageBuilderRouteProps): Promise<Metadata> {
  const slug = joinSlug(params.slug);

  if (!slug) {
    return {};
  }

  const locale = await getLocale();
  const page = await getPublicPage(slug, locale as Locale);

  if (!page) {
    return {};
  }

  return {
    title: page.translation.title || page.page.title,
    description: page.translation.description ?? undefined,
  };
}

export default async function PageBuilderRoute({
  params,
  searchParams,
}: PageBuilderRouteProps) {
  const slug = joinSlug(params.slug);
const search = await searchParams;
  if (!slug) {
    notFound();
  }

  const locale = await resolveLocale(search);
  const preview = search?.preview === "true" || search?.draft === "true";
  const page = preview
    ? await getPublicPagePreview(slug, locale)
    : await getPublicPage(slug, locale);

  if (!page) {
    notFound();
  }

  const document = toDocument(page.document as PageBuilderDocument);

  return (
    <div className="bg-white">
      <PageBuilderRenderer data={document} />
    </div>
  );
}
