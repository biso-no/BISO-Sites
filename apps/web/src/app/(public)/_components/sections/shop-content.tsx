"use client";

import { useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { useCampus } from "@/components/context/campus";
import { Card, CardContent, CardTitle } from "@repo/ui/components/ui/card";

import type { ProductWithTranslations } from "@/lib/types/product";

interface ShopContentProps {
  products: ProductWithTranslations[];
}

export function ShopContent({ products }: ShopContentProps) {
  const { activeCampusId } = useCampus();
  const t = useTranslations("home");

  const filteredProducts = useMemo(() => {
    if (!activeCampusId) return products;
    return products.filter((product) => product.campus_id === activeCampusId);
  }, [products, activeCampusId]);

  const spotlightProducts = useMemo(() => filteredProducts.slice(0, 3), [filteredProducts]);

  if (filteredProducts.length === 0) {
    return (
      <div className="col-span-full rounded-2xl border border-dashed border-primary/20 bg-white/60 p-10 text-center text-muted-foreground">
        {t("shop.empty")}
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      {spotlightProducts.map((product) => (
        <Card key={product.$id} className="group overflow-hidden border border-primary/10 bg-white/90 shadow-md transition hover:-translate-y-1 hover:shadow-card-hover">
          {product.image || product.images?.[0] ? (
            <div className="relative h-60 w-full overflow-hidden">
              <Image
                src={product.image || product.images![0]}
                alt={product.title || product.slug}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-105"
              />
            </div>
          ) : null}
          <CardContent className="space-y-2 p-6">
            <CardTitle className="text-lg font-semibold text-primary-100">
              {product.slug ? (
                <Link href={`/shop/${product.slug}`} className="hover:underline">
                  {product.title || product.slug}
                </Link>
              ) : (
                product.title || 'Untitled Product'
              )}
            </CardTitle>
            {product.description ? (
              <p className="line-clamp-2 text-sm text-muted-foreground">{product.description}</p>
            ) : null}
            {typeof product.price === "number" ? (
              <div className="text-base font-semibold text-primary-40">
                {t("shop.price", { value: product.price.toFixed(2) })}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
