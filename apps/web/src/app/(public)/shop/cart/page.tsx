import { Metadata } from "next"
import { PublicPageHeader } from "@/components/public/PublicPageHeader"
import { CartPageClient } from "./cart-page-client"

export const metadata: Metadata = {
  title: "Cart | BISO Shop",
}

export default function CartPage() {
  return (
    <div className="space-y-6">
      <PublicPageHeader
        title="Shopping cart"
        subtitle="Review your items before checkout"
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Shop", href: "/shop" },
          { label: "Cart" },
        ]}
      />
      <CartPageClient />
    </div>
  )
}
