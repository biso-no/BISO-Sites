"use client";

import { motion } from "motion/react";
import { ShoppingBag, Tag, ChevronRight } from "lucide-react";
import { Card } from "@repo/ui/components/ui/card";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Separator } from "@repo/ui/components/ui/separator";
import { ImageWithFallback } from "@repo/ui/components/image";
import { ContentTranslations } from "@repo/api/types/appwrite";
import Link from "next/link";

interface ProductsTabProps {
  products: ContentTranslations[];
  isMember: boolean;
}

export function ProductsTab({ products, isMember }: ProductsTabProps) {
  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <h2 className="text-3xl font-bold text-foreground mb-4">Products & Event Tickets</h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Get your tickets and merchandise from this department
        </p>
      </motion.div>

      {products.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {products.map((product, index) => {
            const productRef = product.product_ref;
            
            return (
              <motion.div
                key={product.$id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Link href={`/shop/${productRef?.slug || product.content_id}`}>
                  <Card 
                    className="overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all group cursor-pointer"
                  >
                    <div className="relative h-64 overflow-hidden bg-muted">
                      {productRef?.image && (
                        <ImageWithFallback
                          src={productRef.image}
                          alt={product.title || 'Product'}
                          fill
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        />
                      )}
                      {productRef?.member_only && (
                        <Badge className="absolute top-4 left-4 bg-[#001731] text-white border-0">
                          Members Only
                        </Badge>
                      )}
                      {productRef?.category && (
                        <Badge className="absolute top-4 right-4 bg-[#3DA9E0] text-white border-0">
                          <Tag className="w-3 h-3 mr-1" />
                          {productRef.category}
                        </Badge>
                      )}
                      
                      {productRef?.stock !== null && productRef?.stock !== undefined && productRef.stock < 20 && productRef.stock > 0 && (
                        <Badge className="absolute bottom-4 right-4 bg-orange-500 text-white border-0">
                          Only {productRef.stock} left!
                        </Badge>
                      )}
                      
                      {productRef?.stock !== null && productRef?.stock !== undefined && productRef.stock === 0 && (
                        <Badge className="absolute bottom-4 right-4 bg-red-500 text-white border-0">
                          Sold Out
                        </Badge>
                      )}
                    </div>

                    <div className="p-6">
                      <h3 className="text-xl font-semibold text-foreground mb-2 group-hover:text-[#3DA9E0] transition-colors">
                        {product.title || 'Untitled Product'}
                      </h3>
                      <p className="text-muted-foreground text-sm mb-4 line-clamp-2">
                        {product.short_description || product.description || ''}
                      </p>

                      <Separator className="my-4" />

                      <div className="flex items-center justify-between">
                        <div>
                          {productRef?.member_price && isMember ? (
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xl font-bold text-foreground">
                                  {productRef.member_price} NOK
                                </span>
                                <Badge 
                                  variant="outline" 
                                  className="text-xs border-green-200 text-green-700 bg-green-50 dark:border-green-800 dark:text-green-400 dark:bg-green-950"
                                >
                                  Member
                                </Badge>
                              </div>
                              <span className="text-sm text-muted-foreground line-through">
                                {productRef.regular_price} NOK
                              </span>
                            </div>
                          ) : (
                            <div>
                              <span className="text-xl font-bold text-foreground">
                                {productRef?.regular_price || 0} NOK
                              </span>
                              {productRef?.member_price && !isMember && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  {productRef.member_price} NOK for members
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <Button 
                          size="sm"
                          disabled={productRef?.stock === 0}
                          className="bg-linear-to-r from-[#3DA9E0] to-[#001731] hover:from-[#3DA9E0]/90 hover:to-[#001731]/90 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {productRef?.stock === 0 ? 'Sold Out' : 'View'}
                          {productRef?.stock !== 0 && <ChevronRight className="w-4 h-4 ml-1" />}
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
        <Card className="p-12 text-center border-0 shadow-lg">
          <ShoppingBag className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-foreground mb-2">No Products Available</h3>
          <p className="text-muted-foreground">
            Check back soon for new products and event tickets!
          </p>
        </Card>
      )}
    </div>
  );
}
