"use client";

import Link from "next/link";
import { cn } from "../../lib/utils";
import { ImageWithFallback } from "../image";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";

export type ProductsGridItem = {
  id?: string;
  title: string;
  image?: string;
  href?: string;
  price?: string;
  badge?: string;
};

export type ProductsGridProps = {
  title?: string;
  subtitle?: string;
  variant?: "grid" | "carousel";
  columns?: 2 | 3 | 4;
  products: ProductsGridItem[];
};

export function ProductsGrid({
  title,
  subtitle,
  variant = "grid",
  columns = 3,
  products = [],
}: ProductsGridProps) {
  const gridCols = {
    2: "md:grid-cols-2",
    3: "md:grid-cols-3",
    4: "md:grid-cols-2 lg:grid-cols-4",
  } as const;

  return (
    <div className="w-full py-12">
      {(title || subtitle) && (
        <div className="mx-auto mb-12 max-w-3xl text-center">
          {title && (
            <h2 className="mb-4 font-bold text-3xl text-foreground tracking-tight sm:text-4xl">
              {title}
            </h2>
          )}
          {subtitle && <p className="text-lg text-muted-foreground">{subtitle}</p>}
        </div>
      )}

      {products.length > 0 && variant === "grid" && (
        <div className={cn("grid gap-8", gridCols[columns])}>
          {products.map((product) => (
            <Card
              className="group flex h-full flex-col overflow-hidden border-0 shadow-lg transition-all duration-300 hover:shadow-2xl"
              key={product.id ?? product.href ?? product.title}
            >
              <div className="relative h-56 overflow-hidden">
                <ImageWithFallback
                  alt={product.title}
                  className="object-cover transition-transform duration-500 group-hover:scale-110"
                  fill
                  sizes="(max-width: 768px) 100vw, 400px"
                  src={product.image || "/images/logo-home.png"}
                />
                <div className="absolute inset-0 bg-linear-to-t from-black/40 via-transparent to-transparent" />

                {product.badge && (
                  <div className="absolute top-4 left-4">
                    <Badge className="border-0 bg-white/90 text-foreground backdrop-blur-sm">
                      {product.badge}
                    </Badge>
                  </div>
                )}
              </div>

              <div className="flex grow flex-col p-6">
                <h3 className="mb-2 font-semibold text-foreground text-xl">
                  {product.title}
                </h3>

                {product.price && (
                  <div className="mb-6 font-bold text-foreground text-xl">
                    {product.price}
                  </div>
                )}

                {product.href ? (
                  <Button asChild className="mt-auto w-full" variant="gradient">
                    <Link href={product.href}>View</Link>
                  </Button>
                ) : (
                  <Button className="mt-auto w-full" disabled variant="outline">
                    View
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {products.length > 0 && variant === "carousel" && (
        <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2">
          {products.map((product) => (
            <Card
              className="group w-[280px] shrink-0 snap-start overflow-hidden border-0 shadow-lg transition-all duration-300 hover:shadow-2xl"
              key={product.id ?? product.href ?? product.title}
            >
              <div className="relative h-44 overflow-hidden">
                <ImageWithFallback
                  alt={product.title}
                  className="object-cover transition-transform duration-500 group-hover:scale-110"
                  fill
                  sizes="280px"
                  src={product.image || "/images/logo-home.png"}
                />
                <div className="absolute inset-0 bg-linear-to-t from-black/40 via-transparent to-transparent" />
                {product.badge && (
                  <div className="absolute top-3 left-3">
                    <Badge className="border-0 bg-white/90 text-foreground backdrop-blur-sm">
                      {product.badge}
                    </Badge>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2 p-4">
                <div className="font-semibold text-foreground">{product.title}</div>
                {product.price && (
                  <div className="font-bold text-foreground">{product.price}</div>
                )}
                {product.href && (
                  <Button asChild className="mt-2 w-full" size="sm" variant="outline">
                    <Link href={product.href}>View</Link>
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

