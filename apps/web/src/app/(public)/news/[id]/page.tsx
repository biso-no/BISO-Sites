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
  if (item.news_ref.status && item.news_ref.status !== "published") {
    return notFound();
  }

  return (
    <div className="space-y-6">
      <PublicPageHeader
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "News", href: "/news" },
          { label: item.title },
        ]}
        subtitle={[
          new Date(item.news_ref.$createdAt).toLocaleDateString(),
          item.news_ref.campus?.name,
          item.news_ref.department?.Name,
        ]
          .filter(Boolean)
          .join(" · ")}
        title={item.title}
      />
      {item.news_ref.image && (
        <div className="relative h-64 w-full overflow-hidden rounded-lg">
          <Image
            alt={item.title}
            className="object-cover"
            fill
            src={item.news_ref.image}
          />
        </div>
      )}
      <HtmlContent html={item.description || ""} />
    </div>
  );
}
