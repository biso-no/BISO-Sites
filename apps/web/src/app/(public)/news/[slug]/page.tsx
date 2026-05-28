import type { ContentTranslations } from "@repo/api/types/appwrite";
import { PlateContentRenderer } from "@repo/ui/components/plate-content-renderer";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getLocale } from "@/app/actions/locale";
import { getNewsBySlug } from "@/app/actions/news";
import { PublicPageHeader } from "@/components/public/public-page-header";

function pickTranslation(item: Awaited<ReturnType<typeof getNewsBySlug>>) {
  if (!(item && Array.isArray(item.translation_refs))) {
    return null;
  }
  return (
    item.translation_refs.find(
      (entry): entry is ContentTranslations =>
        typeof entry === "object" && entry !== null && "title" in entry
    ) ?? null
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    const locale = await getLocale();
    const item = await getNewsBySlug(slug, locale);
    const translation = pickTranslation(item);
    const title = translation?.title ?? "News";
    const description =
      translation?.short_description ??
      translation?.description?.slice(0, 160) ??
      undefined;
    return { title: `${title} | BISO`, description };
  } catch {
    return { title: "News | BISO" };
  }
}

export default async function PublicNewsDetailBySlug({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const locale = await getLocale();
  const item = await getNewsBySlug(slug, locale);

  if (!item) {
    return notFound();
  }
  if (item.status && item.status !== "published") {
    return notFound();
  }

  const translation = Array.isArray(item.translation_refs)
    ? item.translation_refs.find(
        (entry): entry is ContentTranslations =>
          typeof entry === "object" && entry !== null && "title" in entry
      )
    : null;
  const title = translation?.title ?? "News";
  const description = translation?.description ?? "";

  return (
    <div className="space-y-6">
      <PublicPageHeader
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "News", href: "/news" },
          { label: title },
        ]}
        subtitle={[
          new Date(item.$createdAt).toLocaleDateString(),
          item.campus?.name,
          item.department?.Name,
        ]
          .filter(Boolean)
          .join(" · ")}
        title={title}
      />
      {item.image && (
        <div className="relative h-64 w-full overflow-hidden rounded-lg">
          <Image alt={title} className="object-cover" fill src={item.image} />
        </div>
      )}
      <PlateContentRenderer value={description} />
    </div>
  );
}
