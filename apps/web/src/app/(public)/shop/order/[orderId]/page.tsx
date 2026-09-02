import { Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import type { Orders } from "@repo/api/types/appwrite";
import { getOrderItems } from "@repo/shared/utils/order-parsing";
import { Card } from "@repo/ui/components/ui/card";
import { Separator } from "@repo/ui/components/ui/separator";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { format } from "date-fns";
import {
  CheckCircle2,
  Clock,
  MapPin,
  Package,
  Receipt,
  Sparkles,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { getOrder, verifyOrder } from "@/app/actions/orders";
import { CartResetOnSuccess } from "@/components/shop/cart-reset-on-success";
import { OrderActionsClient } from "@/components/shop/order-details-client";
import {
  OrderReceipt,
  type ReceiptItem,
} from "@/components/shop/order-receipt";
import { PurchaseTracker } from "@/components/shop/purchase-tracker";
import { ShopPageShell } from "@/components/shop/v2/shop-page-shell";
import { Pill } from "@/components/ui/pill";
import { normalizeCampusKey } from "@/lib/shop/pickup-locations";

interface OrderPageProps {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ success?: string }>;
}

type OrderStatusKey =
  | "pending"
  | "authorized"
  | "paid"
  | "cancelled"
  | "failed"
  | "refunded";

// Visual config only — labels/descriptions are localized at render time.
const statusVisual: Record<
  OrderStatusKey,
  { Icon: typeof Clock; color: string; bg: string; border: string }
> = {
  pending: {
    Icon: Clock,
    color: "text-orange-600",
    bg: "bg-orange-50",
    border: "border-orange-200",
  },
  authorized: {
    Icon: Clock,
    color: "text-brand",
    bg: "bg-blue-50",
    border: "border-blue-200",
  },
  paid: {
    Icon: CheckCircle2,
    color: "text-green-600",
    bg: "bg-green-50",
    border: "border-green-200",
  },
  cancelled: {
    Icon: XCircle,
    color: "text-muted-foreground",
    bg: "bg-section",
    border: "border-border",
  },
  failed: {
    Icon: XCircle,
    color: "text-red-600",
    bg: "bg-red-50",
    border: "border-red-200",
  },
  refunded: {
    Icon: XCircle,
    color: "text-purple-600",
    bg: "bg-purple-50",
    border: "border-purple-200",
  },
};

const statusLabelKey: Record<OrderStatusKey, string> = {
  pending: "pending",
  authorized: "authorized",
  paid: "paid",
  cancelled: "cancelledLabel",
  failed: "failedLabel",
  refunded: "refunded",
};

const statusDescKey: Record<OrderStatusKey, string> = {
  pending: "pendingDesc",
  authorized: "authorizedDesc",
  paid: "paidDesc",
  cancelled: "cancelledDesc",
  failed: "failedDesc",
  refunded: "refundedDesc",
};

interface RawOrderItem {
  custom_fields?: { id: string; label: string; value: string }[];
  name?: string;
  price?: number;
  quantity: number;
  title?: string;
  unit_price?: number;
  variation_name?: string;
}

const MEMBERSHIP_ITEM_PATTERN = /member/i;

// Classify an order for the revenue event so membership conversions can be
// segmented from merch in Umami. Membership is bought through the same checkout,
// so we infer from the line-item titles rather than a dedicated order flag.
function resolvePurchaseType(
  items: RawOrderItem[]
): "membership" | "merch" | "mixed" {
  if (items.length === 0) {
    return "merch";
  }
  const membershipCount = items.filter((item) =>
    MEMBERSHIP_ITEM_PATTERN.test(item.title ?? item.name ?? "")
  ).length;
  if (membershipCount === 0) {
    return "merch";
  }
  return membershipCount === items.length ? "membership" : "mixed";
}

async function StatusBanner({
  order,
  isSuccess,
}: {
  order: Orders;
  isSuccess: boolean;
}) {
  const t = await getTranslations("shop");
  const status = order.status as OrderStatusKey;
  const showSuccess = isSuccess && status === "paid";
  const showFailed = status === "failed" || status === "cancelled";

  if (showSuccess) {
    return (
      <div className="mb-8 rounded-3xl border border-green-200 bg-green-50 p-6">
        <div className="flex items-start gap-4">
          <CheckCircle2 className="h-8 w-8 shrink-0 text-green-600" />
          <div>
            <h2 className="mb-2 font-bold text-2xl text-foreground">
              {t("order.success.title")}
            </h2>
            <p className="mb-4 text-muted-foreground">
              {t("order.success.desc")}
            </p>
            {order.payment_receipt_url ? (
              <OrderActionsClient
                receiptUrl={order.payment_receipt_url}
                type="receipt"
              />
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  if (showFailed) {
    const isCancelled = status === "cancelled";
    return (
      <div
        className={`mb-8 rounded-3xl border p-6 ${statusVisual[status].border} ${statusVisual[status].bg}`}
      >
        <div className="flex items-start gap-4">
          <XCircle
            className={`h-8 w-8 shrink-0 ${statusVisual[status].color}`}
          />
          <div>
            <h2 className="mb-2 font-bold text-2xl text-foreground">
              {isCancelled
                ? t("order.cancelled.title")
                : t("order.failed.title")}
            </h2>
            <p className="mb-4 text-muted-foreground">
              {isCancelled ? t("order.cancelled.desc") : t("order.failed.desc")}
            </p>
            <OrderActionsClient type="cart" />
          </div>
        </div>
      </div>
    );
  }

  return null;
}

async function CustomerInfoCard({ order }: { order: Orders }) {
  const t = await getTranslations("shop");
  if (!(order.buyer_name || order.buyer_email || order.buyer_phone)) {
    return null;
  }

  return (
    <Card className="rounded-3xl border border-border/60 p-6 shadow-sm">
      <h3 className="mb-4 font-bold text-foreground">
        {t("order.customer.title")}
      </h3>
      <div className="space-y-2 text-sm">
        {order.buyer_name ? (
          <div>
            <strong>{t("order.customer.name")}:</strong> {order.buyer_name}
          </div>
        ) : null}
        {order.buyer_email ? (
          <div>
            <strong>{t("order.customer.email")}:</strong> {order.buyer_email}
          </div>
        ) : null}
        {order.buyer_phone ? (
          <div>
            <strong>{t("order.customer.phone")}:</strong> {order.buyer_phone}
          </div>
        ) : null}
      </div>
    </Card>
  );
}

async function MembershipWelcomeCard() {
  const t = await getTranslations("shop");
  return (
    <Card className="rounded-3xl border border-brand-border bg-brand-muted p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
        <div>
          <h4 className="mb-2 font-semibold text-foreground">
            {t("order.membershipWelcome.title")}
          </h4>
          <p className="mb-4 text-muted-foreground text-sm">
            {t("order.membershipWelcome.desc")}
          </p>
          <Link
            className="font-medium text-brand text-sm hover:underline"
            href="/member"
          >
            {t("order.membershipWelcome.cta")}
          </Link>
        </div>
      </div>
    </Card>
  );
}

function getHeroTitleKey(showSuccess: boolean, isMembershipOnly: boolean) {
  if (!showSuccess) {
    return "order.detailsTitle";
  }
  return isMembershipOnly
    ? "order.membershipConfirmedTitle"
    : "order.confirmedTitle";
}

function SecondaryInfoCard({
  isMembershipOnly,
  isPaid,
  pickupLocation,
}: {
  isMembershipOnly: boolean;
  isPaid: boolean;
  pickupLocation: string;
}) {
  if (!isPaid) {
    return null;
  }
  return isMembershipOnly ? (
    <MembershipWelcomeCard />
  ) : (
    <PickupInfoCard pickupLocation={pickupLocation} />
  );
}

async function PickupInfoCard({ pickupLocation }: { pickupLocation: string }) {
  const t = await getTranslations("shop");
  return (
    <Card className="rounded-3xl border border-brand-border bg-brand-muted p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <Package className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
        <div>
          <h4 className="mb-2 font-semibold text-foreground">
            {t("order.pickup.title")}
          </h4>
          <p className="mb-2 text-muted-foreground text-sm">
            {t("order.pickup.desc")}
          </p>
          <div className="flex items-center gap-2 text-foreground text-sm">
            <MapPin className="h-4 w-4 text-brand" />
            <span className="font-medium">{pickupLocation}</span>
          </div>
          <p className="mt-3 text-muted-foreground text-xs">
            {t("order.pickup.emailNote")}
          </p>
        </div>
      </div>
    </Card>
  );
}

async function OrderItemsCard({
  order,
  items,
}: {
  order: Orders;
  items: RawOrderItem[];
}) {
  const t = await getTranslations("shop");

  return (
    <Card className="rounded-3xl border border-border/60 p-6 shadow-sm">
      <h2 className="mb-6 font-bold text-foreground text-xl">
        {t("order.items.title")}
      </h2>
      <div className="space-y-4">
        {items.map((item, index) => {
          const itemName = item.title || item.name || "Product";
          const itemPrice = item.unit_price ?? item.price ?? 0;
          return (
            <div
              className="flex gap-4 rounded-2xl bg-section/50 p-4"
              key={`${itemName}-${index}`}
            >
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">{itemName}</h3>
                <div className="mt-1 text-muted-foreground text-sm">
                  {t("order.items.quantity")}: {item.quantity}
                </div>
                {item.variation_name ? (
                  <div className="mt-1 text-muted-foreground text-sm">
                    {t("order.items.variant")}: {item.variation_name}
                  </div>
                ) : null}
                {item.custom_fields?.length ? (
                  <div className="mt-2 space-y-1 text-muted-foreground text-sm">
                    {item.custom_fields.map((field) => (
                      <div key={field.id}>
                        <strong>{field.label}:</strong> {field.value}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="text-right">
                <div className="font-semibold text-foreground">
                  {(itemPrice * item.quantity).toFixed(2)} {order.currency}
                </div>
                <div className="text-muted-foreground text-sm">
                  {itemPrice.toFixed(2)} {order.currency}{" "}
                  {t("order.items.each")}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Separator className="my-6" />

      <div className="space-y-2">
        <div className="flex justify-between text-muted-foreground">
          <span>{t("order.totals.subtotal")}</span>
          <span>
            {order.subtotal.toFixed(2)} {order.currency}
          </span>
        </div>
        {order.discount_total && order.discount_total > 0 ? (
          <div className="flex justify-between text-green-600">
            <span>{t("order.totals.discount")}</span>
            <span>
              -{order.discount_total.toFixed(2)} {order.currency}
            </span>
          </div>
        ) : null}
        {order.membership_applied ? (
          <div className="text-brand text-sm">
            ✓{" "}
            {t("order.totals.memberApplied", {
              percent: order.member_discount_percent ?? 0,
            })}
          </div>
        ) : null}
        <Separator className="my-2" />
        <div className="flex justify-between font-bold text-foreground text-xl">
          <span>{t("order.totals.total")}</span>
          <span>
            {order.total.toFixed(2)} {order.currency}
          </span>
        </div>
      </div>
    </Card>
  );
}

async function resolveCampusName(campusId?: string | null) {
  if (!campusId) {
    return null;
  }
  try {
    const { db } = await createSessionClient();
    const campus = await db.getRow("app", "campus", campusId, [
      Query.select(["name"]),
    ]);
    return (campus as { name?: string | null }).name ?? null;
  } catch {
    return null;
  }
}

/**
 * The order body, extracted so the two chromes — the current hero-and-container
 * and `ShopPageShell` — wrap the same markup instead of duplicating it.
 * Nothing inside it changed.
 */
async function OrderBody({
  isMembershipOnly,
  isSuccess,
  order,
  orderDate,
  pickupLocation,
  rawItems,
  status,
  statusDesc,
  statusLabel,
  visual,
}: {
  isMembershipOnly: boolean;
  isSuccess: boolean;
  order: Orders;
  orderDate: string;
  pickupLocation: string;
  rawItems: RawOrderItem[];
  status: string;
  statusDesc: string;
  statusLabel: string;
  visual: (typeof statusVisual)[OrderStatusKey];
}) {
  const t = await getTranslations("shop");
  return (
    <>
      <StatusBanner isSuccess={isSuccess} order={order} />

      <div className="grid gap-8 md:grid-cols-3">
        <div className="space-y-8 md:col-span-2">
          <Card className="rounded-3xl border border-border/60 p-6 shadow-sm">
            <h2 className="mb-4 font-bold text-foreground text-xl">
              {t("order.status.title")}
            </h2>
            <div className="mb-4 flex items-center gap-3">
              <span
                className={`rounded-full px-4 py-2 font-medium text-base ${visual.bg} ${visual.color}`}
              >
                {statusLabel}
              </span>
              <span className="text-muted-foreground">{statusDesc}</span>
            </div>
            <div className="text-muted-foreground text-sm">
              <div>
                <strong>{t("order.status.date")}:</strong> {orderDate}
              </div>
              {order.payment_intent_id ? (
                <div className="mt-2">
                  <strong>{t("order.status.paymentId")}:</strong>{" "}
                  {order.payment_intent_id}
                </div>
              ) : null}
            </div>
          </Card>

          <OrderItemsCard items={rawItems} order={order} />
        </div>

        <div className="space-y-6">
          <CustomerInfoCard order={order} />
          <SecondaryInfoCard
            isMembershipOnly={isMembershipOnly}
            isPaid={status === "paid"}
            pickupLocation={pickupLocation}
          />

          <div className="space-y-3">
            <OrderActionsClient type="shop" />
            <OrderActionsClient type="print">
              <Receipt className="mr-2 h-4 w-4" />
              {t("order.actions.print")}
            </OrderActionsClient>
          </div>
        </div>
      </div>
    </>
  );
}

async function OrderDetails({
  orderId,
  isSuccess,
}: {
  orderId: string;
  isSuccess: boolean;
}) {
  const t = await getTranslations("shop");
  const order: Orders | null = isSuccess
    ? await verifyOrder(orderId)
    : await getOrder(orderId);

  if (!order) {
    notFound();
  }

  // Defense-in-depth: orders carry per-user read permissions, but verify
  // ownership explicitly so a guessed orderId can't leak buyer PII. The literal
  // "guest" owner is the legacy/anonymous fallback that relies on read("any").
  if (order.userId !== "guest") {
    const { account } = await createSessionClient();
    const caller = await account.get().catch(() => null);
    if (!(caller && order.userId) || order.userId !== caller.$id) {
      notFound();
    }
  }

  const status = order.status as OrderStatusKey;
  const visual = statusVisual[status] ?? statusVisual.pending;
  const statusLabel = t(`order.status.${statusLabelKey[status] ?? "pending"}`);
  const statusDesc = t(
    `order.status.${statusDescKey[status] ?? "pendingDesc"}`
  );

  const rawItems = getOrderItems(order) as RawOrderItem[];
  const purchaseType = resolvePurchaseType(rawItems);
  const isMembershipOnly = purchaseType === "membership";
  const receiptItems: ReceiptItem[] = rawItems.map((item) => ({
    name: item.title || item.name || "Product",
    quantity: item.quantity,
    unitPrice: item.unit_price ?? item.price ?? 0,
    variant: item.variation_name ?? null,
  }));

  const orderDate = format(
    new Date(order.$createdAt),
    "MMMM d, yyyy 'at' HH:mm"
  );
  const orderIdShort = order.$id.slice(-8).toUpperCase();

  const campusName = await resolveCampusName(order.campus_id);
  const pickupLocation = t(`pickup.campus.${normalizeCampusKey(campusName)}`);

  const showSuccess = isSuccess && status === "paid";
  // The return route redirects both "paid" and "authorized" with success=true,
  // and applyOrderStatusTransition deletes the buyer's reservations on either
  // transition — so the client cart must be reset for both, not just "paid".
  const reservationsCleared =
    isSuccess && (status === "paid" || status === "authorized");
  const heroTitle = t(getHeroTitleKey(showSuccess, isMembershipOnly));
  const [tCommon, tNav] = await Promise.all([
    getTranslations("common"),
    getTranslations("common.navigation"),
  ]);

  return (
    <>
      {reservationsCleared ? <CartResetOnSuccess /> : null}
      {showSuccess ? (
        <PurchaseTracker
          campus={campusName ?? undefined}
          orderId={order.$id}
          revenue={order.total}
          type={purchaseType}
        />
      ) : null}

      {/* `print:hidden` has to stay on the outermost screen element: printing
          must yield `<OrderReceipt>` alone, not the receipt behind a full copy
          of the page. `ShopPageShell` forwards the class for exactly this. */}
      <ShopPageShell
        breadcrumbs={[
          { label: tCommon("breadcrumbs.home"), href: "/" },
          { label: tNav("shop"), href: "/shop" },
          { label: t("order.orderNumber", { id: orderIdShort }) },
        ]}
        className="print:hidden"
        lede={t("order.orderNumber", { id: orderIdShort })}
        meta={<Pill tone="neutral">{statusLabel}</Pill>}
        title={heroTitle}
      >
        <OrderBody
          isMembershipOnly={isMembershipOnly}
          isSuccess={isSuccess}
          order={order}
          orderDate={orderDate}
          pickupLocation={pickupLocation}
          rawItems={rawItems}
          status={status}
          statusDesc={statusDesc}
          statusLabel={statusLabel}
          visual={visual}
        />
      </ShopPageShell>

      <OrderReceipt
        items={receiptItems}
        order={order}
        orderDate={orderDate}
        orderNumber={orderIdShort}
        pickupLocation={pickupLocation}
      />
    </>
  );
}

export default async function OrderPage({
  params,
  searchParams,
}: OrderPageProps) {
  const { orderId } = await params;
  const { success } = await searchParams;
  const isSuccess = success === "true";

  return (
    <Suspense fallback={<OrderDetailsSkeleton />}>
      <OrderDetails isSuccess={isSuccess} orderId={orderId} />
    </Suspense>
  );
}

function OrderDetailsSkeleton() {
  return (
    <div className="min-h-screen bg-linear-to-b from-section to-background">
      <div className="relative h-[36vh]">
        <Skeleton className="h-full w-full" />
      </div>
      <div className="mx-auto max-w-4xl px-4 py-12">
        <Skeleton className="mb-8 h-24 w-full rounded-3xl" />
        <div className="grid gap-8 md:grid-cols-3">
          <div className="space-y-8 md:col-span-2">
            <Skeleton className="h-40 w-full rounded-3xl" />
            <Skeleton className="h-80 w-full rounded-3xl" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-32 w-full rounded-3xl" />
            <Skeleton className="h-48 w-full rounded-3xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

export async function generateMetadata({ params }: OrderPageProps) {
  const { orderId } = await params;
  const order = await getOrder(orderId);

  if (!order) {
    return { title: "Order Not Found | BISO Shop" };
  }

  return {
    title: `Order #${order.$id.slice(-8)} | BISO Shop`,
    description: `View details for order #${order.$id.slice(-8)}`,
  };
}
