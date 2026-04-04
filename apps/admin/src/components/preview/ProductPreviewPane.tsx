"use client";

import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Package, ShoppingCart, Tag, Users } from "lucide-react";
import Image from "next/image";
import type { Locale } from "@/components/forms/LocaleTabGroup";

type ProductFormSnapshot = {
  status: string;
  category?: string;
  regular_price?: number;
  member_price?: number;
  member_only?: boolean;
  stock?: number;
  image?: string;
  metadata?: { images?: string[] };
  translations: {
    en: { title: string; description: string };
    no: { title: string; description: string };
  };
};

function fmtNok(n: number) {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    minimumFractionDigits: 0,
  }).format(n);
}

export function ProductPreviewPane({
  data,
  locale,
}: {
  data: ProductFormSnapshot;
  locale: Locale;
}) {
  const t = data.translations[locale];
  const title = t.title || (locale === "en" ? "Product Name" : "Produktnavn");
  const imageUrl = data.metadata?.images?.[0] ?? data.image ?? "";
  const inStock = data.stock === undefined || data.stock > 0;

  return (
    <div className="min-h-full bg-background font-sans">
      {/* Hero */}
      <div className="relative h-56 overflow-hidden bg-slate-100">
        {imageUrl ? (
          <Image src={imageUrl} alt={title} fill className="object-cover" sizes="800px" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
            <Package className="h-16 w-16 text-slate-300" />
          </div>
        )}
        {data.status !== "published" && (
          <div className="absolute top-3 left-3">
            <Badge variant="secondary" className="uppercase text-xs">
              {data.status}
            </Badge>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main */}
          <div className="space-y-5 lg:col-span-2">
            <div>
              {data.category && (
                <p className="mb-1 flex items-center gap-1.5 text-muted-foreground text-xs uppercase tracking-wide">
                  <Tag className="h-3 w-3" />
                  {data.category}
                </p>
              )}
              <h1 className="font-bold text-2xl">{title}</h1>
            </div>

            {t.description ? (
              <article
                className="prose prose-sm max-w-none"
                // biome-ignore lint/security/noDangerouslySetInnerHtml: preview only
                dangerouslySetInnerHTML={{ __html: t.description }}
              />
            ) : (
              <p className="italic text-muted-foreground text-sm">
                {locale === "en"
                  ? "Product description will appear here…"
                  : "Produktbeskrivelse vises her…"}
              </p>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              {/* Pricing */}
              <div>
                {data.regular_price !== undefined && (
                  <p className="font-bold text-2xl">
                    {fmtNok(data.regular_price)}
                  </p>
                )}
                {data.member_price !== undefined && (
                  <p className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium mt-0.5">
                    <Users className="h-3.5 w-3.5" />
                    {locale === "en" ? "Member price:" : "Medlemspris:"}{" "}
                    {fmtNok(data.member_price)}
                  </p>
                )}
                {data.member_only && (
                  <Badge className="mt-2 border-blue-200 bg-blue-50 text-blue-700 text-xs">
                    {locale === "en" ? "Members only" : "Kun for medlemmer"}
                  </Badge>
                )}
              </div>

              {/* Stock */}
              {data.stock !== undefined && (
                <p className={`text-sm ${inStock ? "text-emerald-600" : "text-destructive"}`}>
                  {inStock
                    ? locale === "en"
                      ? `${data.stock} in stock`
                      : `${data.stock} på lager`
                    : locale === "en"
                      ? "Out of stock"
                      : "Utsolgt"}
                </p>
              )}

              <Button className="w-full gap-2" disabled={!inStock}>
                <ShoppingCart className="h-4 w-4" />
                {locale === "en" ? "Add to cart" : "Legg i handlekurv"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <PreviewWatermark />
    </div>
  );
}

function PreviewWatermark() {
  return (
    <div className="pointer-events-none fixed right-3 top-14 z-50 rounded-full bg-amber-100 px-2.5 py-1 text-amber-700 text-xs font-medium ring-1 ring-amber-200">
      Preview
    </div>
  );
}
