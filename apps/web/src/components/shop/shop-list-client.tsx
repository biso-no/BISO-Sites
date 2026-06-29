"use client";

import type {
  ContentTranslations,
  WebshopProducts,
} from "@repo/api/types/appwrite";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { Input } from "@repo/ui/components/ui/input";
import { Filter, Loader2, Search, ShoppingBag, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { listProducts } from "@/app/actions/webshop";
import { useCampus } from "@/components/context/campus";
import {
  getInitialShopCategory,
  SHOP_CATEGORIES,
  type ShopCategory,
} from "@/lib/member-portal-utils";
import { ProductCard } from "./product-card";

interface ShopListClientProps {
  isMember?: boolean;
  products: WebshopProducts[];
}

export function ShopListClient({
  products: initialProducts,
  isMember = false,
}: ShopListClientProps) {
  const t = useTranslations("shop");
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocale() as "en" | "no";
  const { activeCampusId } = useCampus();

  const [products, setProducts] = useState<WebshopProducts[]>(initialProducts);
  const [selectedCategory, setSelectedCategory] = useState<ShopCategory>(() =>
    getInitialShopCategory(searchParams.get("category"))
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setSelectedCategory(getInitialShopCategory(searchParams.get("category")));
  }, [searchParams]);

  // Re-fetch products when campus or locale changes
  useEffect(() => {
    const fetchProducts = async () => {
      setIsLoading(true);
      try {
        const newProducts = await listProducts({
          locale,
          status: "published",
          limit: 100,
          campus: activeCampusId || "all",
        });
        setProducts(newProducts);
      } catch (error) {
        console.error("Failed to fetch products:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProducts();
  }, [activeCampusId, locale]);

  // Filter products based on search and category
  const filteredProducts = products.filter((product) => {
    const productData = product;
    const translation = Array.isArray(product.translation_refs)
      ? product.translation_refs.find(
          (item): item is ContentTranslations =>
            typeof item === "object" && item !== null && "title" in item
        )
      : null;
    const title = translation?.title ?? "";
    const description = translation?.description ?? "";
    const shortDescription = translation?.short_description ?? "";

    // Filter out member-only products if user is not a member
    if (productData?.member_only && !isMember) {
      return false;
    }

    const matchesCategory =
      selectedCategory === "All" || productData?.category === selectedCategory;
    const matchesSearch =
      title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shortDescription.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesCategory && matchesSearch;
  });

  const handleViewDetails = (product: WebshopProducts) => {
    const slug = product.slug || product.$id;
    router.push(`/shop/${slug}`);
  };

  return (
    <>
      {/* Filters & Search */}
      <div className="sticky top-20 z-40 border-border border-b bg-background/95 shadow-lg backdrop-blur-lg">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            {/* Search */}
            <div className="relative w-full md:w-96">
              <Search className="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="w-full border-brand-border pr-10 pl-10 focus:border-brand"
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("filters.searchPlaceholder")}
                type="text"
                value={searchQuery}
              />
              {searchQuery && (
                <button
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground"
                  onClick={() => setSearchQuery("")}
                  type="button"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Category Filter */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Filter className="h-5 w-5 text-brand-dark" />
              {SHOP_CATEGORIES.map((category) => (
                <Button
                  className={
                    selectedCategory === category
                      ? "border-0 bg-brand text-white hover:bg-brand/90"
                      : "border-brand-border text-brand-dark hover:bg-brand-muted"
                  }
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  size="sm"
                  variant={
                    selectedCategory === category ? "default" : "outline"
                  }
                >
                  {category === "All"
                    ? t("filters.all")
                    : t(`filters.${category}`)}
                </Button>
              ))}
            </div>
          </div>

          <div className="mt-4 text-center text-muted-foreground">
            {t("filters.showingResults", { count: filteredProducts.length })}
          </div>
        </div>
      </div>

      {/* Products Grid */}
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-brand" />
            <span className="ml-3 text-muted-foreground">
              {t("loading.message")}
            </span>
          </div>
        ) : (
          <>
            <AnimatePresence mode="wait">
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                className="grid gap-8 md:grid-cols-2 lg:grid-cols-3"
                exit={{ opacity: 0, y: -20 }}
                initial={{ opacity: 0, y: 20 }}
                key={selectedCategory + searchQuery}
              >
                {filteredProducts.map((product, index) => (
                  <ProductCard
                    index={index}
                    isMember={isMember}
                    key={product.$id}
                    onViewDetails={handleViewDetails}
                    product={product}
                  />
                ))}
              </motion.div>
            </AnimatePresence>

            {/* No Results */}
            {filteredProducts.length === 0 && (
              <motion.div
                animate={{ opacity: 1 }}
                className="py-16 text-center"
                initial={{ opacity: 0 }}
              >
                <ShoppingBag className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
                <h3 className="mb-2 font-bold text-2xl text-foreground">
                  {t("emptyState.title")}
                </h3>
                <p className="mb-6 text-muted-foreground">
                  {t("emptyState.description")}
                </p>
                <Button
                  className="border-brand text-brand-dark hover:bg-brand-muted"
                  onClick={() => {
                    setSelectedCategory("All");
                    setSearchQuery("");
                  }}
                  variant="outline"
                >
                  {t("filters.clearFilters")}
                </Button>

                {/* Membership CTA */}
                <Card className="mx-auto mt-10 max-w-sm border-brand/30 p-6 text-left">
                  <h4 className="mb-2 font-semibold text-foreground">
                    {t("emptyState.membershipTitle")}
                  </h4>
                  <p className="mb-4 text-muted-foreground text-sm">
                    {t("emptyState.membershipBody")}
                  </p>
                  <Button asChild size="sm">
                    <Link href="/shop/membership">
                      {t("emptyState.membershipCta")}
                    </Link>
                  </Button>
                </Card>
              </motion.div>
            )}
          </>
        )}
      </div>

      {/* Pickup Info */}
      <div className="bg-brand-dark py-12 text-white">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <h3 className="mb-4 font-bold text-2xl">{t("pickup.title")}</h3>
          <p className="mb-4 text-lg text-white/80">
            {t("pickup.description")}
          </p>
          <p className="font-semibold text-brand text-lg">
            <strong>{t("pickup.officeHours")}</strong> {t("pickup.hours")}
          </p>
        </div>
      </div>
    </>
  );
}
