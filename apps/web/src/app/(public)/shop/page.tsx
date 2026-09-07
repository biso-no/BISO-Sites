import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getLocale } from "@/app/actions/locale";
import { listProducts } from "@/app/actions/webshop";
import { ShopV2 } from "@/components/shop/v2/shop-v2";
import { FeedSkeleton } from "@/components/ui/loading-shell";
import { getMembershipStatus } from "@/lib/actions/membership";
import { getUserPreferences } from "@/lib/auth-utils";
import { resolveRequestCampus } from "@/lib/campus-scope";
import { toPlainText } from "@/lib/content-text";

export const metadata = {
  // A campus-scoped feed is a filtered view of the same collection, so it
  // points its canonical at the unscoped URL rather than competing with it.
  alternates: { canonical: "/shop" },
  title: "Shop | BISO",
  description:
    "Browse our selection of merch, trip deductibles, campus lockers, and memberships",
};

async function ShopListV2({
  campus,
  isMember,
  locale,
  searchParams,
  searchQuery,
}: {
  campus: string | null;
  isMember: boolean;
  locale: "en" | "no";
  searchParams: Record<string, string | string[] | undefined>;
  searchQuery: string;
}) {
  // **No `locale` here, deliberately.** `listProducts` turns that argument into
  // `Query.equal("translation_refs.locale", …)`, which drops any product
  // without a row in that language — and only **3 of the 55 published products
  // have an English translation**. An English-speaking student was being shown
  // a shop with three items in it. Every translation is fetched instead and
  // `getPrimaryTranslation` prefers the reader's locale per product, falling
  // back to the one that exists. A Norwegian product title in an English shop
  // is a smaller problem than a shop that is 95% invisible.
  const products = await listProducts({
    status: "published",
    limit: 100,
    campus: campus || "all",
  });

  // Search is applied here rather than in the query: `listProducts` has no
  // text predicate, and the titles live one relation away in
  // `translation_refs`. Searching every translation is the point — a reader
  // who types a Norwegian product name finds it whichever locale they are in.
  const needle = searchQuery.trim().toLowerCase();
  const matched = needle
    ? products.filter((product) => {
        // Descriptions are stored as CMS rich text, so the tags are flattened
        // away before matching — otherwise a query like "p" or "strong" hits
        // every product's markup instead of its copy.
        const haystack = toPlainText(
          (Array.isArray(product.translation_refs)
            ? product.translation_refs
            : []
          )
            .flatMap((entry) =>
              typeof entry === "object" && entry !== null
                ? [
                    (entry as { title?: string }).title,
                    (entry as { short_description?: string }).short_description,
                    (entry as { description?: string }).description,
                  ]
                : []
            )
            .filter(Boolean)
            .join(" ")
        ).toLowerCase();
        return haystack.includes(needle);
      })
    : products;

  return (
    <ShopV2
      campusId={campus}
      isMember={isMember}
      locale={locale}
      products={matched}
      searchParams={searchParams}
      searchQuery={searchQuery}
    />
  );
}

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Locale comes from `getLocale()`, not from user preferences: those carry no
  // locale until the visitor sets one, and the `?? "en"` beneath disagreed with
  // `DEFAULT_LOCALE` ("no"), so a first visit got Norwegian chrome over English
  // product copy. Same fix as `/news` and `/jobs`.
  const [prefs, locale, sp] = await Promise.all([
    getUserPreferences(),
    getLocale(),
    searchParams,
  ]);

  const { isMember } = await getMembershipStatus();

  // `?campus=` joins the other feeds here (RD-016). v1 read the campus from
  // a client context and re-fetched the whole list in an effect, so a shop
  // scoped to one campus had no URL.
  const campus = resolveRequestCampus(sp.campus, prefs?.campusId);
  if (campus === undefined) {
    notFound();
  }

  return (
    <Suspense fallback={<FeedSkeleton />}>
      <ShopListV2
        campus={campus}
        isMember={isMember}
        locale={locale}
        searchParams={sp}
        searchQuery={typeof sp.search === "string" ? sp.search : ""}
      />
    </Suspense>
  );
}
