"use client";

import type { ContentTranslations } from "@repo/api/types/appwrite";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Filter, Loader2, Search, ShoppingBag, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { useEffect, useState } from "react";
import { listProducts } from "@/app/actions/webshop";
import { useCampus } from "@/components/context/campus";
import { ProductCard } from "./product-card";

type ShopListClientProps = {
  products: ContentTranslations[];
  isMember?: boolean;
};

const categories = ["All", "Merch", "Trips", "Lockers", "Membership"];

export function ShopListClient({
  products: initialProducts,
  isMember = false,
}: ShopListClientProps) {
  const router = useRouter();
  const locale = useLocale() as "en" | "no";
  const { activeCampusId } = useCampus();

  const [products, setProducts] =
    useState<ContentTranslations[]>(initialProducts);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);

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
    const productData = product.product_ref;

    // Filter out member-only products if user is not a member
    if (productData?.member_only && !isMember) {
      return false;
    }

    const matchesCategory =
      selectedCategory === "All" || productData?.category === selectedCategory;
    const matchesSearch =
      product.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (product.short_description || "")
        .toLowerCase()
        .includes(searchQuery.toLowerCase());

    return matchesCategory && matchesSearch;
  });

  const handleViewDetails = (product: ContentTranslations) => {
    const slug = product.product_ref?.slug || product.content_id;
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
              <Search className="-translate-y-1/2 absolute top-1/2 left-3 h-5 w-5 text-muted-foreground" />
              <Input
                className="w-full border-[#3DA9E0]/20 pr-10 pl-10 focus:border-[#3DA9E0]"
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products..."
                type="text"
                value={searchQuery}
              />
              {searchQuery && (
                <button
                  className="-translate-y-1/2 absolute top-1/2 right-3 text-muted-foreground hover:text-muted-foreground"
                  onClick={() => setSearchQuery("")}
                  type="button"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Category Filter */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Filter className="h-5 w-5 text-[#001731]" />
              {categories.map((category) => (
                <Button
                  className={
                    selectedCategory === category
                      ? "border-0 bg-[#3DA9E0] text-white hover:bg-[#3DA9E0]/90"
                      : "border-[#3DA9E0]/20 text-[#001731] hover:bg-[#3DA9E0]/10"
                  }
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  size="sm"
                  variant={
                    selectedCategory === category ? "default" : "outline"
                  }
                >
                  {category}
                </Button>
              ))}
            </div>
          </div>

          <div className="mt-4 text-center text-muted-foreground">
            Showing {filteredProducts.length}{" "}
            {filteredProducts.length === 1 ? "product" : "products"}
          </div>
        </div>
      </div>

      {/* Products Grid */}
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-[#3DA9E0]" />
            <span className="ml-3 text-muted-foreground">Loading products...</span>
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
                  No products found
                </h3>
                <p className="mb-6 text-muted-foreground">
                  Try adjusting your search or filters
                </p>
                <Button
                  className="border-[#3DA9E0] text-[#001731] hover:bg-[#3DA9E0]/10"
                  onClick={() => {
                    setSelectedCategory("All");
                    setSearchQuery("");
                  }}
                  variant="outline"
                >
                  Clear Filters
                </Button>
              </motion.div>
            )}
          </>
        )}
      </div>

      {/* Pickup Info */}
      <div className="bg-[#001731] py-12 text-white">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <h3 className="mb-4 font-bold text-2xl">
            All Products Available for Campus Pickup
          </h3>
          <p className="mb-4 text-lg text-white/80">
            All items purchased in the BISO Shop are available for pickup at the
            BISO office during opening hours. No shipping fees, no hassle - just
            convenient campus pickup!
          </p>
          <p className="font-semibold text-[#3DA9E0] text-lg">
            <strong>BISO Office Hours:</strong> Monday-Friday, 10:00-16:00
          </p>
        </div>
      </div>
    </>
  );
}
