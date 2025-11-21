import type { Metadata } from "next";
import { PublicPageHeader } from "@/components/public/PublicPageHeader";
import { CheckoutPageClient } from "./checkout-page-client";

export const metadata: Metadata = {
  title: "Checkout | BISO Shop",
};

export default function CheckoutPage() {
  return (
    <div className="space-y-6">
      <PublicPageHeader
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Shop", href: "/shop" },
          { label: "Checkout" },
        ]}
        subtitle="Secure payment with Vipps or card"
        title="Checkout"
      />
      <CheckoutPageClient />
    </div>
  );
}
