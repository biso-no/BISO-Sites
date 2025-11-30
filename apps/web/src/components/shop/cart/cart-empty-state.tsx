import { Button } from "@repo/ui/components/ui/button";
import { ShoppingCart } from "lucide-react";
import Link from "next/link";

export function CartEmptyState() {
  return (
    <div className="fade-in slide-in-from-bottom-4 animate-in py-16 text-center duration-500">
      <ShoppingCart className="mx-auto mb-6 h-24 w-24 text-gray-300" />
      <h2 className="mb-4 font-bold text-2xl text-gray-900">
        Your cart is empty
      </h2>
      <p className="mb-8 text-gray-600 text-lg">
        Start adding some amazing BISO products to your cart!
      </p>
      <Button
        asChild
        className="bg-linear-to-r from-[#3DA9E0] to-[#001731] text-white hover:from-[#3DA9E0]/90 hover:to-[#001731]/90"
      >
        <Link href="/shop">Continue Shopping</Link>
      </Button>
    </div>
  );
}
