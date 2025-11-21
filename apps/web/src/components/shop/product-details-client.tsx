"use client";

import type { ContentTranslations } from "@repo/api/types/appwrite";
import { ImageWithFallback } from "@repo/ui/components/image";
import { Alert, AlertDescription } from "@repo/ui/components/ui/alert";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { Separator } from "@repo/ui/components/ui/separator";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  MapPin,
  Package,
  ShoppingCart,
  Tag,
  Users,
} from "lucide-react";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  createOrUpdateReservation,
  getAvailableStock,
} from "@/app/actions/cart-reservations";
import { validatePurchaseLimits } from "@/app/actions/purchase-limits";
import { useCart } from "@/lib/contexts/cart-context";
import {
  calculateSavings,
  formatPrice,
  getDisplayPrice,
  type ProductOption,
  parseProductMetadata,
} from "@/lib/types/webshop";

type ProductDetailsClientProps = {
  product: ContentTranslations;
  isMember?: boolean;
  userId?: string | null;
};

const categoryColors: Record<string, string> = {
  Merch: "bg-purple-100 text-purple-700 border-purple-200",
  Trips: "bg-blue-100 text-blue-700 border-blue-200",
  Lockers: "bg-green-100 text-green-700 border-green-200",
  Membership: "bg-orange-100 text-orange-700 border-orange-200",
};

export function ProductDetailsClient({
  product,
  isMember = false,
  userId = null,
}: ProductDetailsClientProps) {
  const router = useRouter();
  const { addItem } = useCart();
  const [selectedOptions, setSelectedOptions] = useState<
    Record<string, string>
  >({});
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [addedToCart, setAddedToCart] = useState(false);
  const [availableStock, setAvailableStock] = useState<number | null>(null);
  const [isLoadingStock, setIsLoadingStock] = useState(false);

  const productRef = product.product_ref;
  const metadata = parseProductMetadata(productRef?.metadata);
  const productOptions = (metadata.product_options as ProductOption[]) || [];

  const displayPrice = getDisplayPrice(
    productRef?.regular_price ?? 0,
    productRef?.member_price,
    isMember
  );
  const hasDiscount =
    isMember &&
    productRef?.member_price &&
    productRef?.member_price < (productRef?.regular_price ?? 0);
  const savings = calculateSavings(
    productRef?.regular_price ?? 0,
    productRef?.member_price
  );

  const imageUrl =
    productRef?.image ||
    "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1080";

  // Load available stock on mount
  useEffect(() => {
    async function loadAvailableStock() {
      if (productRef?.stock === null || productRef?.stock === undefined) {
        setAvailableStock(null); // Infinite stock
        return;
      }

      setIsLoadingStock(true);
      const available = await getAvailableStock(productRef?.$id ?? "");
      setAvailableStock(available);
      setIsLoadingStock(false);
    }

    loadAvailableStock();
  }, [productRef?.$id, productRef?.stock]);

  const handleAddToCart = async () => {
    // Validate required options
    const newErrors: Record<string, boolean> = {};

    productOptions.forEach((option, index) => {
      if (option.required && !selectedOptions[`option-${index}`]) {
        newErrors[`option-${index}`] = true;
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const quantity = 1; // Adding 1 item at a time

    // Check available stock (considering reservations)
    if (productRef?.stock !== null && productRef?.stock !== undefined) {
      const currentAvailable = await getAvailableStock(productRef?.$id ?? "");

      if (currentAvailable < quantity) {
        toast.error(
          currentAvailable === 0
            ? "This item is out of stock"
            : `Only ${currentAvailable} available (others reserved in carts)`
        );
        setAvailableStock(currentAvailable);
        return;
      }
    }

    // Validate purchase limits (userId handled by session)
    const limitCheck = await validatePurchaseLimits(
      productRef?.$id ?? "",
      userId || "guest", // TODO: Get from session when available
      quantity,
      metadata
    );

    if (!limitCheck.allowed) {
      toast.error(limitCheck.reason || "Purchase limit exceeded");
      return;
    }

    // Convert indexed options to named options
    const namedOptions: Record<string, string> = {};
    productOptions.forEach((option, index) => {
      const value = selectedOptions[`option-${index}`];
      if (value) {
        namedOptions[option.label] = value;
      }
    });

    // Create reservation for this stock
    if (productRef?.stock !== null && productRef?.stock !== undefined) {
      const reservationResult = await createOrUpdateReservation(
        productRef?.$id ?? "",
        quantity
      );

      if (!reservationResult.success) {
        toast.error("Failed to reserve stock. Please try again.");
        return;
      }

      // Update available stock display
      const newAvailable = await getAvailableStock(productRef?.$id ?? "");
      setAvailableStock(newAvailable);
    }

    // Add to cart
    addItem({
      contentId: product.content_id,
      productId: productRef?.$id ?? "",
      slug: productRef?.slug ?? "",
      name: product.title,
      image: productRef?.image,
      category: productRef?.category ?? "",
      regularPrice: productRef?.regular_price ?? 0,
      memberPrice: productRef?.member_price,
      memberOnly: productRef?.member_only ?? false,
      stock: productRef?.stock,
      selectedOptions:
        Object.keys(namedOptions).length > 0 ? namedOptions : undefined,
      metadata: {
        max_per_user:
          typeof metadata.max_per_user === "number"
            ? metadata.max_per_user
            : undefined,
        max_per_order:
          typeof metadata.max_per_order === "number"
            ? metadata.max_per_order
            : undefined,
        sku: typeof metadata.sku === "string" ? metadata.sku : undefined,
      },
    });

    setAddedToCart(true);
    toast.success("Added to cart");
    setTimeout(() => setAddedToCart(false), 3000);
  };

  const handleOptionChange = (optionIndex: number, value: string) => {
    setSelectedOptions({
      ...selectedOptions,
      [`option-${optionIndex}`]: value,
    });

    // Clear error for this option
    if (errors[`option-${optionIndex}`]) {
      const newErrors = { ...errors };
      delete newErrors[`option-${optionIndex}`];
      setErrors(newErrors);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-gray-50 to-white">
      {/* Hero Section */}
      <div className="relative h-[60vh] overflow-hidden">
        <ImageWithFallback
          alt={product.title}
          className="object-cover"
          fill
          src={imageUrl}
        />
        <div className="absolute inset-0 bg-linear-to-br from-[#001731]/90 via-[#3DA9E0]/60 to-[#001731]/85" />

        <div className="absolute inset-0">
          <div className="mx-auto flex h-full max-w-6xl items-center px-4">
            <motion.button
              animate={{ opacity: 1, x: 0 }}
              className="absolute top-8 left-8 flex items-center gap-2 text-white transition-colors hover:text-[#3DA9E0]"
              initial={{ opacity: 0, x: -20 }}
              onClick={() => router.push("/shop")}
            >
              <ArrowLeft className="h-5 w-5" />
              Back to Shop
            </motion.button>

            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="mt-12"
              initial={{ opacity: 0, y: 20 }}
            >
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <Badge className={categoryColors[productRef?.category ?? ""]}>
                  {productRef?.category}
                </Badge>
                {productRef?.member_only && (
                  <Badge className="border-0 bg-orange-500 text-white">
                    <Users className="mr-1 h-3 w-3" />
                    Members Only
                  </Badge>
                )}
                {hasDiscount && savings > 0 && (
                  <Badge className="border-0 bg-green-500 text-white">
                    <Tag className="mr-1 h-3 w-3" />
                    Save {savings} NOK
                  </Badge>
                )}
              </div>

              <h1 className="mb-4 font-bold text-4xl text-white md:text-5xl">
                {product.title}
              </h1>

              <div className="flex items-baseline gap-3">
                {hasDiscount ? (
                  <>
                    <span className="font-bold text-3xl text-white">
                      {formatPrice(displayPrice)}
                    </span>
                    <span className="text-white/60 text-xl line-through">
                      {formatPrice(productRef?.regular_price ?? 0)}
                    </span>
                    <Badge className="border-0 bg-green-500 text-white">
                      Member Discount
                    </Badge>
                  </>
                ) : (
                  <span className="font-bold text-3xl text-white">
                    {formatPrice(displayPrice)}
                  </span>
                )}
              </div>

              {!isMember &&
                productRef?.member_price &&
                productRef?.member_price < (productRef?.regular_price ?? 0) && (
                  <p className="mt-3 text-lg text-white/80">
                    🎉 Members pay only {formatPrice(productRef.member_price)} -
                    Save{" "}
                    {(productRef.regular_price ?? 0) - productRef.member_price}{" "}
                    NOK!
                  </p>
                )}
            </motion.div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main Content */}
          <div className="space-y-8 lg:col-span-2">
            {/* Description */}
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              initial={{ opacity: 0, y: 20 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="border-0 p-8 shadow-lg">
                <h2 className="mb-4 font-bold text-2xl text-gray-900">
                  Product Description
                </h2>
                <p className="whitespace-pre-line text-gray-700 leading-relaxed">
                  {product.description}
                </p>
              </Card>
            </motion.div>

            {/* Product Options */}
            {productOptions.length > 0 && (
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                initial={{ opacity: 0, y: 20 }}
                transition={{ delay: 0.2 }}
              >
                <Card className="border-0 p-8 shadow-lg">
                  <h2 className="mb-6 font-bold text-2xl text-gray-900">
                    Product Options
                  </h2>
                  <div className="space-y-6">
                    {productOptions.map((option, index) => (
                      <div key={index}>
                        <Label className="mb-2 block font-semibold">
                          {option.label}
                          {option.required && (
                            <span className="ml-1 text-red-500">*</span>
                          )}
                        </Label>

                        {option.type === "select" && option.options ? (
                          <Select
                            onValueChange={(value) =>
                              handleOptionChange(index, value)
                            }
                            value={selectedOptions[`option-${index}`] || ""}
                          >
                            <SelectTrigger
                              className={`w-full ${errors[`option-${index}`] ? "border-red-500" : ""}`}
                            >
                              <SelectValue
                                placeholder={`Select ${option.label.toLowerCase()}`}
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {option.options.map((opt) => (
                                <SelectItem key={opt} value={opt}>
                                  {opt}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            className={
                              errors[`option-${index}`] ? "border-red-500" : ""
                            }
                            onChange={(e) =>
                              handleOptionChange(index, e.target.value)
                            }
                            placeholder={option.placeholder || option.label}
                            type="text"
                            value={selectedOptions[`option-${index}`] || ""}
                          />
                        )}

                        {errors[`option-${index}`] && (
                          <p className="mt-1 text-red-500 text-sm">
                            This field is required
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              </motion.div>
            )}

            {/* Pickup Information */}
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              initial={{ opacity: 0, y: 20 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="border-0 bg-blue-50 p-6 shadow-lg">
                <div className="flex items-start gap-3">
                  <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                  <div>
                    <h4 className="mb-2 font-semibold text-gray-900">
                      Campus Pickup
                    </h4>
                    <p className="mb-2 text-gray-700 text-sm">
                      All products are available for pickup at the BISO office.
                      No shipping, no hassle!
                    </p>
                    <div className="text-gray-600 text-sm">
                      <strong>BISO Office:</strong> Main Building, Ground Floor
                      <br />
                      <strong>Hours:</strong> Monday-Friday, 10:00-16:00
                      <br />
                      <strong>Pickup:</strong> Within 5 working days of purchase
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Stock Status */}
            {productRef?.stock !== null && (
              <motion.div
                animate={{ opacity: 1, x: 0 }}
                initial={{ opacity: 0, x: 20 }}
                transition={{ delay: 0.2 }}
              >
                <Card
                  className={`border-0 p-6 shadow-lg ${
                    isLoadingStock
                      ? "bg-gray-50"
                      : availableStock === 0
                        ? "bg-red-50"
                        : availableStock !== null && availableStock <= 10
                          ? "bg-orange-50"
                          : "bg-green-50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Package
                      className={`h-5 w-5 ${
                        isLoadingStock
                          ? "text-gray-600"
                          : availableStock === 0
                            ? "text-red-600"
                            : availableStock !== null && availableStock <= 10
                              ? "text-orange-600"
                              : "text-green-600"
                      }`}
                    />
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">
                        {isLoadingStock
                          ? "Checking availability..."
                          : availableStock === 0
                            ? "Out of Stock"
                            : availableStock !== null && availableStock <= 10
                              ? `Only ${availableStock} available!`
                              : "In Stock"}
                      </div>
                      {!isLoadingStock &&
                        availableStock !== null &&
                        availableStock > 10 && (
                          <div className="text-gray-600 text-sm">
                            {availableStock} available
                          </div>
                        )}
                      {!isLoadingStock &&
                        availableStock !== null &&
                        (productRef?.stock ?? 0) > 0 &&
                        availableStock < (productRef?.stock ?? 0) && (
                          <div className="mt-1 text-gray-500 text-xs">
                            {(productRef?.stock ?? 0) - availableStock} reserved
                            in carts
                          </div>
                        )}
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}

            {/* Add to Cart */}
            <motion.div
              animate={{ opacity: 1, x: 0 }}
              initial={{ opacity: 0, x: 20 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="border-0 bg-linear-to-br from-[#001731] to-[#3DA9E0] p-6 shadow-lg">
                <div className="mb-6 text-center">
                  {hasDiscount ? (
                    <>
                      <div className="mb-1 text-sm text-white/80 line-through">
                        {formatPrice(productRef?.regular_price ?? 0)}
                      </div>
                      <div className="mb-2 font-bold text-4xl text-white">
                        {formatPrice(displayPrice)}
                      </div>
                      <Badge className="border-0 bg-white/20 text-white">
                        Save {savings} NOK
                      </Badge>
                    </>
                  ) : (
                    <div className="font-bold text-4xl text-white">
                      {formatPrice(displayPrice)}
                    </div>
                  )}
                </div>

                {!isMember &&
                  productRef?.member_price &&
                  productRef?.member_price <
                    (productRef?.regular_price ?? 0) && (
                    <Alert className="mb-4 border-white/20 bg-white/10">
                      <AlertCircle className="h-4 w-4 text-white" />
                      <AlertDescription className="text-sm text-white">
                        Become a BISO member to save{" "}
                        {(productRef?.regular_price ?? 0) -
                          productRef.member_price}{" "}
                        NOK on this item!
                      </AlertDescription>
                    </Alert>
                  )}

                <Button
                  className="mb-3 w-full bg-white text-[#001731] hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={productRef?.stock === 0}
                  onClick={handleAddToCart}
                >
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  {productRef?.stock === 0 ? "Out of Stock" : "Add to Cart"}
                </Button>

                {addedToCart && (
                  <motion.div
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-center gap-2 text-sm text-white"
                    initial={{ opacity: 0, y: -10 }}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Added to cart!
                  </motion.div>
                )}
              </Card>
            </motion.div>

            {/* Price Breakdown */}
            <motion.div
              animate={{ opacity: 1, x: 0 }}
              initial={{ opacity: 0, x: 20 }}
              transition={{ delay: 0.4 }}
            >
              <Card className="border-0 p-6 shadow-lg">
                <h3 className="mb-4 font-bold text-gray-900">Price Details</h3>
                <div className="space-y-3">
                  {!isMember &&
                  productRef?.member_price &&
                  productRef?.member_price <
                    (productRef?.regular_price ?? 0) ? (
                    <>
                      <div className="flex justify-between text-gray-600">
                        <span>Regular Price</span>
                        <span>
                          {formatPrice(productRef?.regular_price ?? 0)}
                        </span>
                      </div>
                      <Separator />
                      <div className="flex justify-between text-[#3DA9E0]">
                        <span>Member Price</span>
                        <span>{formatPrice(productRef.member_price)}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between text-green-600">
                        <span>Member Savings</span>
                        <span>
                          -
                          {(productRef?.regular_price ?? 0) -
                            productRef.member_price}{" "}
                          NOK
                        </span>
                      </div>
                    </>
                  ) : hasDiscount ? (
                    <>
                      <div className="flex justify-between text-gray-400 line-through">
                        <span>Regular Price</span>
                        <span>
                          {formatPrice(productRef?.regular_price ?? 0)}
                        </span>
                      </div>
                      <div className="flex justify-between text-green-600">
                        <span>Member Discount</span>
                        <span>-{savings} NOK</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between font-semibold text-gray-900">
                        <span>Your Price</span>
                        <span>{formatPrice(displayPrice)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between font-semibold text-gray-900">
                      <span>Price</span>
                      <span>{formatPrice(displayPrice)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between text-gray-600 text-sm">
                    <span>Shipping</span>
                    <span className="font-medium text-green-600">
                      Free (Campus Pickup)
                    </span>
                  </div>
                  <div className="flex justify-between text-gray-600 text-sm">
                    <span>Tax</span>
                    <span>Included</span>
                  </div>
                </div>
              </Card>
            </motion.div>

            {/* Member Benefits */}
            {!isMember && productRef?.category !== "Membership" && (
              <motion.div
                animate={{ opacity: 1, x: 0 }}
                initial={{ opacity: 0, x: 20 }}
                transition={{ delay: 0.5 }}
              >
                <Card className="border-0 bg-linear-to-br from-orange-50 to-yellow-50 p-6 shadow-lg">
                  <div className="flex items-start gap-3">
                    <Users className="mt-0.5 h-5 w-5 shrink-0 text-orange-600" />
                    <div>
                      <h4 className="mb-2 font-semibold text-gray-900">
                        Not a member yet?
                      </h4>
                      <p className="mb-3 text-gray-700 text-sm">
                        Join BISO from just 350 NOK/semester and enjoy:
                      </p>
                      <ul className="space-y-1 text-gray-600 text-sm">
                        <li>✓ Discounts on all shop items</li>
                        <li>✓ Member-only events</li>
                        <li>✓ Priority registration</li>
                        <li>✓ Partner discounts</li>
                      </ul>
                      <p className="mt-2 mb-3 text-gray-500 text-xs">
                        💡 Best value: Year membership 550 NOK | 3-year 1200 NOK
                      </p>
                      <Button
                        className="mt-2 w-full border-orange-300 text-orange-700 hover:bg-orange-100"
                        onClick={() => router.push("/shop?category=Membership")}
                        size="sm"
                        variant="outline"
                      >
                        Become a Member
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
