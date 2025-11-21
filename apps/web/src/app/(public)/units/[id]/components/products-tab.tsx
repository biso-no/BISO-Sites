"use client";

import type { ContentTranslations } from "@repo/api/types/appwrite";
import { ImageWithFallback } from "@repo/ui/components/image";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { Separator } from "@repo/ui/components/ui/separator";
import { ChevronRight, ShoppingBag, Tag } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";

type ProductsTabProps = {
  products: ContentTranslations[];
  isMember: boolean;
};

export function ProductsTab({ products, isMember }: ProductsTabProps) {
  return (
    <div className="space-y-8">
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="mb-12 text-center"
        initial={{ opacity: 0, y: 20 }}
      >
        <h2 className="mb-4 font-bold text-3xl text-foreground">
          Products & Event Tickets
        </h2>
        <p className="mx-auto max-w-2xl text-muted-foreground">
          Get your tickets and merchandise from this department
        </p>
      </motion.div>

      {products.length > 0 ? (
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {products.map((product, index) => {
            const productRef = product.product_ref;

            return (
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                initial={{ opacity: 0, y: 20 }}
                key={product.$id}
                transition={{ delay: index * 0.1 }}
              >
                <Link href={`/shop/${productRef?.slug || product.content_id}`}>
                  <Card className="group cursor-pointer overflow-hidden border-0 shadow-lg transition-all hover:shadow-xl">
                    <div className="relative h-64 overflow-hidden bg-muted">
                      {productRef?.image && (
                        <ImageWithFallback
                          alt={product.title || "Product"}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                          fill
                          src={productRef.image}
                        />
                      )}
                      {productRef?.member_only && (
                        <Badge className="absolute top-4 left-4 border-0 bg-[#001731] text-white">
                          Members Only
                        </Badge>
                      )}
                      {productRef?.category && (
                        <Badge className="absolute top-4 right-4 border-0 bg-[#3DA9E0] text-white">
                          <Tag className="mr-1 h-3 w-3" />
                          {productRef.category}
                        </Badge>
                      )}

                      {productRef?.stock !== null &&
                        productRef?.stock !== undefined &&
                        productRef.stock < 20 &&
                        productRef.stock > 0 && (
                          <Badge className="absolute right-4 bottom-4 border-0 bg-orange-500 text-white">
                            Only {productRef.stock} left!
                          </Badge>
                        )}

                      {productRef?.stock !== null &&
                        productRef?.stock !== undefined &&
                        productRef.stock === 0 && (
                          <Badge className="absolute right-4 bottom-4 border-0 bg-red-500 text-white">
                            Sold Out
                          </Badge>
                        )}
                    </div>

                    <div className="p-6">
                      <h3 className="mb-2 font-semibold text-foreground text-xl transition-colors group-hover:text-[#3DA9E0]">
                        {product.title || "Untitled Product"}
                      </h3>
                      <p className="mb-4 line-clamp-2 text-muted-foreground text-sm">
                        {product.short_description || product.description || ""}
                      </p>

                      <Separator className="my-4" />

                      <div className="flex items-center justify-between">
                        <div>
                          {productRef?.member_price && isMember ? (
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-foreground text-xl">
                                  {productRef.member_price} NOK
                                </span>
                                <Badge
                                  className="border-green-200 bg-green-50 text-green-700 text-xs dark:border-green-800 dark:bg-green-950 dark:text-green-400"
                                  variant="outline"
                                >
                                  Member
                                </Badge>
                              </div>
                              <span className="text-muted-foreground text-sm line-through">
                                {productRef.regular_price} NOK
                              </span>
                            </div>
                          ) : (
                            <div>
                              <span className="font-bold text-foreground text-xl">
                                {productRef?.regular_price || 0} NOK
                              </span>
                              {productRef?.member_price && !isMember && (
                                <div className="mt-1 text-muted-foreground text-xs">
                                  {productRef.member_price} NOK for members
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <Button
                          className="bg-linear-to-r from-[#3DA9E0] to-[#001731] text-white hover:from-[#3DA9E0]/90 hover:to-[#001731]/90 disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={productRef?.stock === 0}
                          size="sm"
                        >
                          {productRef?.stock === 0 ? "Sold Out" : "View"}
                          {productRef?.stock !== 0 && (
                            <ChevronRight className="ml-1 h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </Card>
                </Link>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <Card className="border-0 p-12 text-center shadow-lg">
          <ShoppingBag className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
          <h3 className="mb-2 font-semibold text-foreground text-xl">
            No Products Available
          </h3>
          <p className="text-muted-foreground">
            Check back soon for new products and event tickets!
          </p>
        </Card>
      )}
    </div>
  );
}
