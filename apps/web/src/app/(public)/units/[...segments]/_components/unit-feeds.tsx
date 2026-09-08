import { resolveStorageFileUrl } from "@repo/api/storage";
import type {
  ContentTranslations,
  News,
  WebshopProducts,
} from "@repo/api/types/appwrite";
import { ImageWithFallback } from "@repo/ui/components/image";
import { Badge } from "@repo/ui/components/ui/badge";
import { Card } from "@repo/ui/components/ui/card";
import { formatDateReadable } from "@repo/ui/lib/utils";
import { Newspaper, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

/**
 * Both feeds are locale-filtered in the query, so exactly one translation
 * arrives per row — but the relationship is still typed as an array, and an
 * unpublished/legacy row can carry none. Read it defensively.
 */
function translationOf(
  refs: ContentTranslations[] | undefined
): ContentTranslations | null {
  return Array.isArray(refs)
    ? (refs.find(
        (item): item is ContentTranslations =>
          typeof item === "object" && item !== null && "title" in item
      ) ?? null)
    : null;
}

export async function UnitNews({
  news,
  unitName,
}: {
  news: News[];
  unitName: string;
}) {
  if (news.length === 0) {
    return null;
  }
  const t = await getTranslations("units");

  return (
    <section>
      <h2 className="mb-6 flex items-center gap-2 font-bold text-2xl text-foreground">
        <Newspaper className="h-6 w-6 text-brand" />
        {t("detail.news.title", { name: unitName })}
      </h2>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {news.map((item) => {
          const translation = translationOf(item.translation_refs);
          const image = resolveStorageFileUrl(item.image);
          return (
            <li key={item.$id}>
              <Card className="group h-full overflow-hidden border-border/50 bg-card/80 p-0 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-brand-border hover:shadow-lg">
                <Link className="block h-full" href={`/news/${item.$id}`}>
                  {image && (
                    <div className="relative h-40 overflow-hidden">
                      <ImageWithFallback
                        alt=""
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        fill
                        sizes="(min-width: 1024px) 20rem, 100vw"
                        src={image}
                      />
                    </div>
                  )}
                  <div className="p-5">
                    <p className="text-muted-foreground text-xs">
                      {formatDateReadable(new Date(item.$createdAt))}
                    </p>
                    <h3 className="mt-2 font-semibold text-foreground transition-colors group-hover:text-brand">
                      {translation?.title ?? unitName}
                    </h3>
                    {translation?.short_description && (
                      <p className="mt-2 line-clamp-2 text-muted-foreground text-sm">
                        {translation.short_description}
                      </p>
                    )}
                  </div>
                </Link>
              </Card>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export async function UnitShop({ products }: { products: WebshopProducts[] }) {
  if (products.length === 0) {
    return null;
  }
  const t = await getTranslations("units");

  return (
    <section>
      <h2 className="mb-6 flex items-center gap-2 font-bold text-2xl text-foreground">
        <ShoppingBag className="h-6 w-6 text-brand" />
        {t("detail.shop.title")}
      </h2>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {products.map((product) => {
          const translation = translationOf(product.translation_refs);
          const image = resolveStorageFileUrl(product.image);
          const soldOut = product.stock === 0;
          return (
            <li key={product.$id}>
              <Card className="group h-full overflow-hidden border-border/50 bg-card/80 p-0 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-brand-border hover:shadow-lg">
                <Link
                  className="block h-full"
                  href={`/shop/${product.slug || product.$id}`}
                >
                  {image && (
                    <div className="relative h-40 overflow-hidden">
                      <ImageWithFallback
                        alt=""
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        fill
                        sizes="(min-width: 1024px) 16rem, 50vw"
                        src={image}
                      />
                    </div>
                  )}
                  <div className="p-5">
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {product.member_only && (
                        <Badge variant="secondary">
                          {t("detail.shop.memberOnly")}
                        </Badge>
                      )}
                      {soldOut && (
                        <Badge variant="destructive">
                          {t("detail.shop.soldOut")}
                        </Badge>
                      )}
                    </div>
                    <h3 className="font-semibold text-foreground transition-colors group-hover:text-brand">
                      {translation?.title ?? product.slug}
                    </h3>
                    <p className="mt-2 font-semibold text-brand">
                      {product.regular_price} kr
                    </p>
                    {product.member_price != null && (
                      <p className="text-muted-foreground text-xs">
                        {t("detail.shop.memberPrice", {
                          price: `${product.member_price} kr`,
                        })}
                      </p>
                    )}
                  </div>
                </Link>
              </Card>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
