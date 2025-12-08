"use client";

import { Currency } from "@repo/api/types/appwrite";
import { initiateVippsCheckout } from "@repo/payment/actions";
import { Alert, AlertDescription } from "@repo/ui/components/ui/alert";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { Separator } from "@repo/ui/components/ui/separator";
import { CreditCard, Package, Sparkles, Tag } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useCart } from "@/lib/contexts/cart-context";

type CartSummaryProps = {
 isMember: boolean;
 userId: string | null;
};

export function CartSummary({ isMember, userId }: CartSummaryProps) {
 const router = useRouter();
 const [isPending, startTransition] = useTransition();
 const { items, getSubtotal, getRegularSubtotal, getTotalSavings } = useCart();

 const subtotal = getSubtotal(isMember);
 const regularSubtotal = getRegularSubtotal();
 const totalSavings = getTotalSavings(isMember);
 const discountTotal = isMember ? totalSavings : 0;

 const hasUnlockableDiscounts =
 !isMember && items.some((item) => item.memberPrice);
 const potentialSavings = isMember
 ? 0
 : regularSubtotal -
 items.reduce((sum, item) => {
 const price = item.memberPrice || item.regularPrice;
 return sum + price * item.quantity;
 }, 0);

 const handleCheckout = () => {
 startTransition(async () => {
 await initiateVippsCheckout({
 userId: userId || "guest", // TODO: Get from auth session
 items: items.map((item) => ({
 productId: item.productId,
 name: item.name,
 price:
 isMember && item.memberPrice ? item.memberPrice : item.regularPrice,
 quantity: item.quantity,
 })),
 subtotal: regularSubtotal,
 discountTotal: discountTotal || undefined,
 total: subtotal,
 currency: Currency.NOK,
 membershipApplied: isMember,
 memberDiscountPercent:
 isMember && totalSavings > 0
 ? Math.round((totalSavings / regularSubtotal) * 100)
 : undefined,
 // TODO: Add customer info from user profile
 });
 });
 };

 return (
 <div className="space-y-6">
 {/* Member Benefits Alert */}
 {hasUnlockableDiscounts && potentialSavings > 0 && (
 <div className="fade-in slide-in-from-bottom-2 animate-in duration-500">
 <Alert className="border-brand bg-linear-to-br from-brand-muted to-cyan-50">
 <Sparkles className="h-4 w-4 text-brand" />
 <AlertDescription>
 <p className="mb-2 text-foreground text-sm">
 <strong>Unlock member discounts!</strong>
 </p>
 <p className="mb-3 text-muted-foreground text-sm">
 You could save {potentialSavings} NOK on this order by becoming
 a BISO member.
 </p>
 <Button
 className="w-full bg-brand text-white hover:bg-brand/90"
 onClick={() => router.push("/shop?category=Membership")}
 size="sm"
 >
 Join BISO - From 350 NOK
 </Button>
 </AlertDescription>
 </Alert>
 </div>
 )}

 {/* Order Summary Card */}
 <div className="fade-in slide-in-from-bottom-2 animate-in delay-150 duration-500">
 <Card className="sticky top-24 border-0 p-6 shadow-lg">
 <h3 className="mb-4 font-bold text-foreground text-xl">
 Order Summary
 </h3>

 <div className="mb-4 space-y-3">
 <div className="flex justify-between text-muted-foreground">
 <span>
 Subtotal ({items.reduce((sum, item) => sum + item.quantity, 0)}{" "}
 items)
 </span>
 <span className="font-medium">
 {isMember ? subtotal : regularSubtotal} NOK
 </span>
 </div>

 {isMember && totalSavings > 0 && (
 <div className="flex justify-between text-green-600">
 <span className="flex items-center gap-1">
 <Tag className="h-4 w-4" />
 Member Discount
 </span>
 <span className="font-medium">-{totalSavings} NOK</span>
 </div>
 )}
 </div>

 <Separator className="my-4" />

 <div className="mb-6 flex justify-between">
 <span className="font-bold text-foreground text-lg">Total</span>
 <div className="text-right">
 <div className="font-bold text-2xl text-brand">
 {subtotal} NOK
 </div>
 </div>
 </div>

 {isMember && totalSavings > 0 && (
 <div className="mb-4 rounded-lg bg-green-50 p-3 text-center">
 <p className="text-green-700 text-sm">
 🎉 You&apos;re saving <strong>{totalSavings} NOK</strong> with
 your membership!
 </p>
 </div>
 )}

 <Button
 className="mb-3 w-full bg-linear-to-r from-brand-gradient-from to-brand-gradient-to text-white hover:from-brand-gradient-from/90 hover:to-brand-gradient-to/90 disabled:opacity-70"
 disabled={isPending}
 onClick={handleCheckout}
 >
 <CreditCard className="mr-2 h-4 w-4" />
 {isPending ? "Processing..." : "Proceed to Checkout"}
 </Button>

 <Button
 className="w-full border-brand-border text-brand-dark hover:bg-brand-muted"
 onClick={() => router.push("/shop")}
 variant="outline"
 >
 Continue Shopping
 </Button>
 </Card>
 </div>

 {/* Pickup Information */}
 <div className="fade-in slide-in-from-bottom-2 animate-in delay-300 duration-500">
 <Card className="border-0 bg-blue-50 p-6 shadow-lg">
 <div className="flex items-start gap-3">
 <Package className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
 <div>
 <h4 className="mb-2 font-semibold text-foreground">
 Campus Pickup
 </h4>
 <p className="mb-2 text-muted-foreground text-sm">
 All items will be available for pickup at the BISO office at
 your campus.
 </p>
 </div>
 </div>
 </Card>
 </div>
 </div>
 );
}
