import { Button } from "@repo/ui/components/ui/button";
import { ShoppingCart } from "lucide-react";
import Link from "next/link";

export function CartEmptyState() {
 return (
 <div className="fade-in slide-in-from-bottom-4 animate-in py-16 text-center duration-500">
 <ShoppingCart className="mx-auto mb-6 h-24 w-24 text-muted-foreground" />
 <h2 className="mb-4 font-bold text-2xl text-foreground">
 Your cart is empty
 </h2>
 <p className="mb-8 text-muted-foreground text-lg">
 Start adding some amazing BISO products to your cart!
 </p>
 <Button
 asChild
 className="bg-linear-to-r from-brand-gradient-from to-brand-gradient-to text-white hover:from-brand-gradient-from/90 hover:to-brand-gradient-to/90"
 >
 <Link href="/shop">Continue Shopping</Link>
 </Button>
 </div>
 );
}
