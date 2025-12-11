import type { Orders } from "@repo/api/types/appwrite";
import { getOrder, verifyOrder } from "@repo/payment/actions";
import { ImageWithFallback } from "@repo/ui/components/image";
import { Badge } from "@repo/ui/components/ui/badge";
import { Card } from "@repo/ui/components/ui/card";
import { Separator } from "@repo/ui/components/ui/separator";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { format } from "date-fns";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  MapPin,
  Package,
  Receipt,
  XCircle,
} from "lucide-react";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { OrderActionsClient } from "@/components/shop/order-details-client"; // New, smaller Client Component

type OrderPageProps = {
  params: {
    orderId: string;
  };
  searchParams: {
    success?: string;
  };
};

// --- Status Configuration (moved to server component) ---
const statusConfig = {
  pending: {
    Icon: Clock,
    color: "text-orange-600",
    bg: "bg-orange-50",
    border: "border-orange-200",
    label: "Pending",
    description: "Awaiting payment confirmation",
  },
  authorized: {
    Icon: Clock,
    color: "text-primary",
    bg: "bg-blue-50",
    border: "border-blue-200",
    label: "Authorized",
    description: "Payment authorized, processing order",
  },
  paid: {
    Icon: CheckCircle2,
    color: "text-green-600",
    bg: "bg-green-50",
    border: "border-green-200",
    label: "Paid",
    description: "Payment successful",
  },
  cancelled: {
    Icon: XCircle,
    color: "text-muted-foreground",
    bg: "bg-section",
    border: "border-border",
    label: "Cancelled",
    description: "Order cancelled",
  },
  failed: {
    Icon: XCircle,
    color: "text-red-600",
    bg: "bg-red-50",
    border: "border-red-200",
    label: "Failed",
    description: "Payment failed",
  },
  refunded: {
    Icon: XCircle,
    color: "text-purple-600",
    bg: "bg-purple-50",
    border: "border-purple-200",
    label: "Refunded",
    description: "Payment refunded",
  },
};

// --- Sub-components to reduce cognitive complexity ---

type StatusConfig = (typeof statusConfig)[keyof typeof statusConfig];

function SuccessBanner({
  config,
  receiptUrl,
}: {
  config: StatusConfig;
  receiptUrl?: string;
}) {
  return (
    <div className={`mb-8 p-6 ${config.bg} ${config.border} border-2`}>
      <div className="flex items-start gap-4">
        <CheckCircle2 className="h-8 w-8 shrink-0 text-green-600" />
        <div>
          <h2 className="mb-2 font-bold text-2xl text-foreground">
            Thank You for Your Purchase!
          </h2>
          <p className="mb-4 text-muted-foreground">
            Your payment has been confirmed and your order is being processed.
            You&apos;ll receive a confirmation email shortly with pickup
            details.
          </p>
          {receiptUrl && (
            <div className="flex flex-wrap gap-2">
              <OrderActionsClient receiptUrl={receiptUrl} type="receipt" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FailedBanner({
  config,
  status,
}: {
  config: StatusConfig;
  status: "failed" | "cancelled";
}) {
  const isCancelled = status === "cancelled";
  return (
    <div className={`mb-8 p-6 ${config.bg} ${config.border} border-2`}>
      <div className="flex items-start gap-4">
        <XCircle className={`h-8 w-8 ${config.color} shrink-0`} />
        <div>
          <h2 className="mb-2 font-bold text-2xl text-foreground">
            {isCancelled ? "Order Cancelled" : "Payment Failed"}
          </h2>
          <p className="mb-4 text-muted-foreground">
            {isCancelled
              ? "This order was cancelled. Your items are still in your cart if you'd like to try again."
              : "The payment for this order failed. Please try again or contact support if the problem persists."}
          </p>
          <OrderActionsClient type="cart" />
        </div>
      </div>
    </div>
  );
}

function CustomerInfoCard({ order }: { order: Orders }) {
  const hasInfo = order.buyer_name || order.buyer_email || order.buyer_phone;
  if (!hasInfo) {
    return null;
  }

  return (
    <Card className="border-0 p-6 shadow-lg">
      <h3 className="mb-4 font-bold text-foreground">Customer Information</h3>
      <div className="space-y-2 text-sm">
        {order.buyer_name && (
          <div>
            <strong>Name:</strong> {order.buyer_name}
          </div>
        )}
        {order.buyer_email && (
          <div>
            <strong>Email:</strong> {order.buyer_email}
          </div>
        )}
        {order.buyer_phone && (
          <div>
            <strong>Phone:</strong> {order.buyer_phone}
          </div>
        )}
      </div>
    </Card>
  );
}

function PickupInfoCard() {
  return (
    <Card className="border-0 bg-blue-50 p-6 shadow-lg">
      <div className="flex items-start gap-3">
        <Package className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div>
          <h4 className="mb-2 font-semibold text-foreground">Pickup Details</h4>
          <p className="mb-2 text-muted-foreground text-sm">
            Your order will be available for pickup at the BISO office.
          </p>
          <div className="text-muted-foreground text-sm">
            <div className="mb-1 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              <span>Main Building, Ground Floor</span>
            </div>
            <strong>Hours:</strong> Monday-Friday, 10:00-16:00
            <br />
            <strong>Pickup:</strong> Within 5 working days
          </div>
          <p className="mt-3 text-muted-foreground text-xs">
            You&apos;ll receive an email when your order is ready for pickup.
          </p>
        </div>
      </div>
    </Card>
  );
}

// --- Main Order Details Server Component ---
async function OrderDetails({
  orderId,
  isSuccess,
}: {
  orderId: string;
  isSuccess: boolean;
}) {
  const order: Orders | null = isSuccess
    ? await verifyOrder(orderId)
    : await getOrder(orderId);

  if (!order) {
    notFound();
  }

  const config =
    statusConfig[order.status as keyof typeof statusConfig] ??
    statusConfig.pending;
  const StatusIcon = config.Icon;

  const items: unknown[] = order.items_json ? JSON.parse(order.items_json) : [];
  const orderDate = format(
    new Date(order.$createdAt),
    "MMMM d, yyyy 'at' HH:mm"
  );
  const orderIdShort = order.$id.slice(-8).toUpperCase();

  const showSuccessBanner = isSuccess && order.status === "paid";
  const showFailedBanner =
    order.status === "failed" || order.status === "cancelled";
  const heroTitle = showSuccessBanner ? "Order Confirmed!" : "Order Details";

  return (
    <div className="min-h-screen bg-linear-to-b from-section to-background">
      {/* Hero Section */}
      <div className="relative h-[40vh] overflow-hidden">
        <ImageWithFallback
          alt="Order Confirmation"
          className="object-cover"
          fill
          src="https://images.unsplash.com/photo-1556742044-3c52d6e88c62?w=1080"
        />
        <div className="absolute inset-0 bg-linear-to-br from-brand-overlay-from via-brand-overlay-via to-brand-overlay-to" />

        <div className="absolute inset-0 flex items-center justify-center">
          <div className="mx-auto max-w-4xl px-4 text-center">
            <OrderActionsClient
              className="absolute top-8 left-8 flex items-center gap-2 text-white transition-colors hover:text-brand"
              type="back"
            >
              <ArrowLeft className="h-5 w-5" />
              Back to Shop
            </OrderActionsClient>

            <div className="mx-auto max-w-4xl px-4 text-center">
              <StatusIcon
                className={`mx-auto mb-4 h-20 w-20 ${config.color}`}
              />
              <h1 className="mb-4 font-bold text-4xl text-white md:text-5xl">
                {heroTitle}
              </h1>
              <p className="text-lg text-white/90">Order #{orderIdShort}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-12">
        {showSuccessBanner && (
          <SuccessBanner
            config={config}
            receiptUrl={order.vipps_receipt_url ?? undefined}
          />
        )}

        {showFailedBanner && (
          <FailedBanner
            config={config}
            status={order.status as "failed" | "cancelled"}
          />
        )}

        <div className="grid gap-8 md:grid-cols-3">
          {/* Main Content */}
          <div className="space-y-8 md:col-span-2">
            {/* Order Status Card */}
            <Card className="border-0 p-6 shadow-lg">
              <h2 className="mb-4 font-bold text-foreground text-xl">
                Order Status
              </h2>
              <div className="mb-4 flex items-center gap-3">
                <Badge
                  className={`${config.bg} ${config.color} border-0 px-4 py-2 text-base`}
                >
                  {config.label}
                </Badge>
                <span className="text-muted-foreground">
                  {config.description}
                </span>
              </div>
              <div className="text-muted-foreground text-sm">
                <div>
                  <strong>Order Date:</strong> {orderDate}
                </div>
                {order.vipps_order_id && (
                  <div className="mt-2">
                    <strong>Vipps Order ID:</strong> {order.vipps_order_id}
                  </div>
                )}
              </div>
            </Card>

            {/* Order Items & Totals Card */}
            <Card className="border-0 p-6 shadow-lg">
              <h2 className="mb-6 font-bold text-foreground text-xl">
                Order Items
              </h2>
              <div className="space-y-4">
                {items.map((item, index) => {
                  const typedItem = item as {
                    name: string;
                    quantity: number;
                    price: number;
                  };
                  return (
                    <div
                      className="flex gap-4 rounded-lg bg-section p-4"
                      key={index}
                    >
                      <div className="flex-1">
                        <h3 className="font-semibold text-foreground">
                          {typedItem.name}
                        </h3>
                        <div className="mt-1 text-muted-foreground text-sm">
                          Quantity: {typedItem.quantity}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-foreground">
                          {(typedItem.price * typedItem.quantity).toFixed(2)}{" "}
                          {order.currency}
                        </div>
                        <div className="text-muted-foreground text-sm">
                          {typedItem.price.toFixed(2)} {order.currency} each
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <Separator className="my-6" />

              {/* Totals Breakdown */}
              <div className="space-y-2">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span>
                    {order.subtotal.toFixed(2)} {order.currency}
                  </span>
                </div>
                {order.discount_total && order.discount_total > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount</span>
                    <span>
                      -{order.discount_total.toFixed(2)} {order.currency}
                    </span>
                  </div>
                )}
                {order.membership_applied && (
                  <div className="text-brand text-sm">
                    ✓ Member discount applied (
                    {order.member_discount_percent ?? 0}%)
                  </div>
                )}
                <div className="flex justify-between text-muted-foreground text-sm">
                  <span>Shipping</span>
                  <span className="text-green-600">Free (Campus Pickup)</span>
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between font-bold text-foreground text-xl">
                  <span>Total</span>
                  <span>
                    {order.total.toFixed(2)} {order.currency}
                  </span>
                </div>
              </div>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <CustomerInfoCard order={order} />
            {order.status === "paid" && <PickupInfoCard />}

            {/* Actions */}
            <div className="space-y-3">
              <OrderActionsClient type="shop" />
              <OrderActionsClient type="print">
                <Receipt className="mr-2 h-4 w-4" />
                Print Order
              </OrderActionsClient>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Next.js Page Wrapper ---
export default function OrderPage({ params, searchParams }: OrderPageProps) {
  const isSuccess = searchParams.success === "true";

  return (
    <Suspense fallback={<OrderDetailsSkeleton />}>
      <OrderDetails isSuccess={isSuccess} orderId={params.orderId} />
    </Suspense>
  );
}

function OrderDetailsSkeleton() {
  return (
    <div className="min-h-screen bg-linear-to-b from-section to-background">
      <div className="relative h-[40vh]">
        <Skeleton className="h-full w-full" />
      </div>
      <div className="mx-auto max-w-4xl px-4 py-12">
        <Skeleton className="mb-8 h-24 w-full" />
        <div className="grid gap-8 md:grid-cols-3">
          <div className="space-y-8 md:col-span-2">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-80 w-full" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      </div>
    </div>
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
