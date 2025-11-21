import Image from "next/image";
import { notFound } from "next/navigation";
import { getLocale } from "@/app/actions/locale";
import { getNewsItem } from "@/app/actions/news";
import { PublicPageHeader } from "@/components/public/PublicPageHeader";

export default async function PublicNewsDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Get user's preferred locale from their account preferences
  const locale = await getLocale();
  const item = await getNewsItem(id, locale);

  if (!item) return notFound();
  if (item.news_ref.status && item.news_ref.status !== "published") {
    return notFound();
  }

  return (
    <div className="space-y-6">
      <PublicPageHeader
        title={item.title}
        subtitle={[
          new Date(item.news_ref.$createdAt).toLocaleDateString(),
          item.news_ref.campus?.name,
          item.news_ref.department?.Name,
        ]
          .filter(Boolean)
          .join(" · ")}
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "News", href: "/news" },
          { label: item.title },
        ]}
      />
      {item.news_ref.image && (
        <div className="relative w-full h-64 rounded-lg overflow-hidden">
          <Image
            src={item.news_ref.image}
            alt={item.title}
            fill
            className="object-cover"
          />
        </div>
      )}
      <article
        className="prose dark:prose-invert max-w-none"
        dangerouslySetInnerHTML={{ __html: item.description || "" }}
      />
    </div>
  );
}
