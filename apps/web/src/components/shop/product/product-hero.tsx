import type { ContentTranslations } from "@repo/api/types/appwrite";
import { ImageWithFallback } from "@repo/ui/components/image";
import { Badge } from "@repo/ui/components/ui/badge";
import { ArrowLeft, Tag, Users } from "lucide-react";
import Link from "next/link";
import {
 calculateSavings,
 formatPrice,
 getDisplayPrice,
} from "@/lib/types/webshop";

const categoryColors: Record<string, string> = {
 Merch: "bg-purple-100 text-purple-700 border-purple-200",
 Trips: "bg-blue-100 text-blue-700 border-blue-200",
 Lockers: "bg-green-100 text-green-700 border-green-200",
 Membership: "bg-orange-100 text-orange-700 border-orange-200",
};

type ProductHeroProps = {
 product: ContentTranslations;
 isMember: boolean;
};

export function ProductHero({ product, isMember }: ProductHeroProps) {
 const productRef = product.product_ref;

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

 return (
 <div className="relative h-[60vh] overflow-hidden">
 <ImageWithFallback
 alt={product.title}
 className="object-cover"
 fill
 priority
 src={imageUrl}
 />
 <div className="absolute inset-0 bg-linear-to-br from-brand-overlay-from via-brand-overlay-via to-brand-overlay-to" />

 <div className="absolute inset-0">
 <div className="mx-auto flex h-full max-w-6xl items-center px-4">
 <Link
 className="absolute top-8 left-8 flex items-center gap-2 text-white transition-colors hover:text-brand"
 href="/shop"
 >
 <ArrowLeft className="h-5 w-5" />
 Back to Shop
 </Link>

 <div className="fade-in slide-in-from-bottom-4 mt-12 animate-in duration-700">
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
 </div>
 </div>
 </div>
 </div>
 );
}
