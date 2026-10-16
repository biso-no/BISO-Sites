import { resolveStorageFileUrl } from "@repo/api/storage";
import type {
  ContentTranslations,
  News,
  WebshopProducts,
} from "@repo/api/types/appwrite";
import type { Locale } from "@repo/i18n/config";
import { ImageWithFallback } from "@repo/ui/components/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CardGrid } from "@/components/ui/card-grid";
import { ChevronFrame } from "@/components/ui/chevron-frame";
import { OptionalLink } from "@/components/ui/optional-link";
import { Pill } from "@/components/ui/pill";
import { RowThumb } from "@/components/ui/row-thumb";
import { Section } from "@/components/ui/section";
import { SectionHeading } from "@/components/ui/section-heading";
import { toPlainText } from "@/lib/content-text";
import { formatArticleDate } from "@/lib/news-article";

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

const ROW =
  "flex items-start gap-4 rounded-biso-md border border-edge p-4 transition-colors hover:border-ink-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

/**
 * The unit's published news, as compact rows.
 *
 * The detail route resolves articles by slug, so a row without one is shown
 * but not linked — `/news/<$id>` would be a guaranteed 404.
 */
export async function UnitNews({
  locale,
  news,
  unitName,
}: {
  locale: Locale;
  news: News[];
  unitName: string;
}) {
  if (news.length === 0) {
    return null;
  }
  const t = await getTranslations("units");

  return (
    <Section className="border-edge border-t" tone="paper">
      <SectionHeading>
        {t("detail.news.title", { name: unitName })}
      </SectionHeading>
      <ul className="grid gap-3 lg:grid-cols-2">
        {news.map((item) => {
          const translation = translationOf(item.translation_refs);
          const teaser = toPlainText(translation?.short_description);
          return (
            <li className="min-w-0" key={item.$id}>
              <OptionalLink
                className={ROW}
                href={item.slug ? `/news/${item.slug}` : null}
              >
                {/* Block wrappers: a heading is not phrasing content, so it
                    cannot sit inside a <span>, though the <a> allows it. */}
                <div className="min-w-0 flex-1">
                  <p className="type-data text-ink-muted">
                    {formatArticleDate(item.$createdAt, locale, "short")}
                  </p>
                  <h3 className="type-heading-card mt-1 break-words text-ink">
                    {translation?.title ?? unitName}
                  </h3>
                  {teaser ? (
                    <p className="type-body-sm mt-1 line-clamp-2 text-ink-muted">
                      {teaser}
                    </p>
                  ) : null}
                </div>
                <RowThumb
                  className="ml-auto"
                  src={resolveStorageFileUrl(item.image)}
                />
              </OptionalLink>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

/**
 * The unit's tickets and merchandise.
 *
 * A members-only product is listed like any other — `member_only` gates the
 * purchase, not the visibility — and marked as such. Link-only products never
 * reach this feed (`cachedUnitProducts` excludes them).
 */
export async function UnitShop({ products }: { products: WebshopProducts[] }) {
  if (products.length === 0) {
    return null;
  }
  const t = await getTranslations("units");

  return (
    <Section className="border-edge border-t" tone="paper">
      <SectionHeading>{t("detail.shop.title")}</SectionHeading>
      <CardGrid columns={4}>
        {products.map((product) => {
          const translation = translationOf(product.translation_refs);
          const image = resolveStorageFileUrl(product.image);
          const soldOut = product.stock === 0;
          return (
            <li className="min-w-0" key={product.$id}>
              <Link
                className="group flex h-full flex-col rounded-biso-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-4 focus-visible:ring-offset-surface"
                href={`/shop/${product.slug || product.$id}`}
              >
                {image ? (
                  <ChevronFrame className="mb-4 bg-surface-sunken" ratio="16/9">
                    <ImageWithFallback
                      alt=""
                      height={360}
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 280px"
                      src={image}
                      width={640}
                    />
                  </ChevronFrame>
                ) : null}

                {product.member_only || soldOut ? (
                  <span className="mb-3 flex flex-wrap gap-2">
                    {product.member_only ? (
                      <Pill tone="warning">{t("detail.shop.memberOnly")}</Pill>
                    ) : null}
                    {soldOut ? (
                      <Pill tone="danger">{t("detail.shop.soldOut")}</Pill>
                    ) : null}
                  </span>
                ) : null}

                <h3 className="type-heading-card break-words text-ink group-hover:text-ink-accent">
                  {translation?.title ?? product.slug}
                </h3>

                <span className="mt-auto pt-4">
                  <span className="type-heading-card block text-ink">
                    {product.regular_price} kr
                  </span>
                  {product.member_price == null ? null : (
                    <span className="type-body-sm mt-1 block text-ink-muted">
                      {t("detail.shop.memberPrice", {
                        price: `${product.member_price} kr`,
                      })}
                    </span>
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </CardGrid>
    </Section>
  );
}
