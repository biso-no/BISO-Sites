import { getOrder, verifyOrder } from "@repo/payment/actions";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { OrderDetailsClient } from "@/components/shop/order-details-client";

interface OrderPageProps {
  params: {
    orderId: string;
  };
  searchParams: {
    success?: string;
  };
}

async function OrderDetails({
  orderId,
  isSuccess,
}: {
  orderId: string;
  isSuccess: boolean;
}) {
  // Verify order status with Vipps to get latest status
  const order = isSuccess
    ? await verifyOrder(orderId)
    : await getOrder(orderId);

  if (!order) {
    notFound();
  }

  return <OrderDetailsClient order={order} isSuccess={isSuccess} />;
}

function OrderDetailsSkeleton() {
  return (
    <div className="min-h-screen bg-linear-to-b from-gray-50 to-white">
      <div className="relative h-[40vh]">
        <Skeleton className="w-full h-full" />
      </div>
      <div className="max-w-4xl mx-auto px-4 py-12">
        <Skeleton className="h-24 w-full mb-8" />
        <div className="grid md:grid-cols-2 gap-8">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
        <Skeleton className="h-96 w-full mt-8" />
      </div>
    </div>
  );
}

export default async function OrderPage({
  params,
  searchParams,
}: OrderPageProps) {
  const isSuccess = searchParams.success === "true";

  return (
    <Suspense fallback={<OrderDetailsSkeleton />}>
      <OrderDetails orderId={params.orderId} isSuccess={isSuccess} />
    </Suspense>
  );
}

// Generate metadata for SEO
export async function generateMetadata({ params }: OrderPageProps) {
  const order = await getOrder(params.orderId);

  if (!order) {
    return {
      title: "Order Not Found | BISO Shop",
    };
  }

  return {
    title: `Order #${order.$id.slice(-8)} | BISO Shop`,
    description: `View details for order #${order.$id.slice(-8)}`,
  };
}
