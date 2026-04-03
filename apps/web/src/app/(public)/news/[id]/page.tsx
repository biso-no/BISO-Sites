import type { ContentTranslations } from "@repo/api/types/appwrite";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getLocale } from "@/app/actions/locale";
import { getNewsItem } from "@/app/actions/news";
import { PublicPageHeader } from "@/components/public/public-page-header";

function HtmlContent({ html }: { html: string }) {
  return (
    <article
      className="prose dark:prose-invert max-w-none"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: Content is authored by trusted admins in the CMS.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export default async function PublicNewsDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Get user's preferred locale from their account preferences
  const locale = await getLocale();
  const item = await getNewsItem(id, locale);

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
      <HtmlContent html={description} />
    </div>
  );
}
