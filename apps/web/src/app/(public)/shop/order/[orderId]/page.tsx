import { Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import type { Orders } from "@repo/api/types/appwrite";
import { getOrderItems } from "@repo/shared/utils/order-parsing";
import { format } from "date-fns";
import { CheckCircle2, MapPin, Receipt, XCircle } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { type ReactNode, Suspense } from "react";
import { getOrder, verifyOrder } from "@/app/actions/orders";
import { CartResetOnSuccess } from "@/components/shop/cart-reset-on-success";
import { OrderActionsClient } from "@/components/shop/order-details-client";
import {
  OrderReceipt,
  type ReceiptItem,
} from "@/components/shop/order-receipt";
import { PurchaseTracker } from "@/components/shop/purchase-tracker";
import { ShopPageShell } from "@/components/shop/v2/shop-page-shell";
import { DetailSkeleton } from "@/components/ui/loading-shell";
import { Pill, type PillTone } from "@/components/ui/pill";
import { upcomingMembershipStart } from "@/lib/membership-order-start";
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

// Visual config only — labels/descriptions are localized at render time. The
// pill's words carry the state; the tone repeats it.
const statusTone: Record<OrderStatusKey, PillTone> = {
  pending: "warning",
  authorized: "accent",
  paid: "success",
  cancelled: "neutral",
  failed: "danger",
  refunded: "neutral",
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

/** A bordered panel on the paper surface — the order page's one card shape. */
const PANEL = "rounded-biso-md border border-edge bg-surface-raised p-6";

interface RawOrderItem {
  custom_fields?: { id: string; label: string; value: string }[];
  name?: string;
  price?: number;
  product_type?: string;
  quantity: number;
  start_date?: string | null;
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

function DetailRow({
  label,
  value,
  className = "text-ink",
}: {
  className?: string;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <dt className="type-body-sm text-ink-muted">{label}</dt>
      <dd className={`type-body-sm min-w-0 text-end ${className}`}>{value}</dd>
    </div>
  );
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
      <div className="mb-8 flex items-start gap-4 rounded-biso-md border border-success/30 bg-success/10 p-6">
        <CheckCircle2
          aria-hidden="true"
          className="mt-0.5 size-6 shrink-0 text-success"
        />
        <div className="min-w-0">
          <h2 className="type-heading-section text-ink">
            {t("order.success.title")}
          </h2>
          <p className="type-body mt-2 text-ink">{t("order.success.desc")}</p>
          {order.payment_receipt_url ? (
            <div className="mt-4">
              <OrderActionsClient
                receiptUrl={order.payment_receipt_url}
                type="receipt"
              />
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  if (showFailed) {
    const isCancelled = status === "cancelled";
    return (
      <div
        className={`mb-8 flex items-start gap-4 rounded-biso-md border p-6 ${
          isCancelled
            ? "border-edge bg-surface-sunken"
            : "border-danger/30 bg-danger/10"
        }`}
      >
        <XCircle
          aria-hidden="true"
          className={`mt-0.5 size-6 shrink-0 ${
            isCancelled ? "text-ink-muted" : "text-danger"
          }`}
        />
        <div className="min-w-0">
          <h2 className="type-heading-section text-ink">
            {isCancelled ? t("order.cancelled.title") : t("order.failed.title")}
          </h2>
          <p className="type-body mt-2 text-ink">
            {isCancelled ? t("order.cancelled.desc") : t("order.failed.desc")}
          </p>
          <div className="mt-4">
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
    <section className={PANEL}>
      <h2 className="type-heading-card text-ink">
        {t("order.customer.title")}
      </h2>
      <dl className="mt-3">
        {order.buyer_name ? (
          <DetailRow
            label={t("order.customer.name")}
            value={order.buyer_name}
          />
        ) : null}
        {order.buyer_email ? (
          <DetailRow
            label={t("order.customer.email")}
            value={<span className="break-all">{order.buyer_email}</span>}
          />
        ) : null}
        {order.buyer_phone ? (
          <DetailRow
            label={t("order.customer.phone")}
            value={order.buyer_phone}
          />
        ) : null}
      </dl>
    </section>
  );
}

/**
 * `startsOn` is set when the membership was bought for next season: it grants
 * nothing until then, so the card must not say "you're a member now".
 */
async function MembershipWelcomeCard({
  startsOn,
}: {
  startsOn: string | null;
}) {
  const t = await getTranslations("shop");
  const formatter = await getFormatter();
  const start = startsOn
    ? formatter.dateTime(new Date(`${startsOn}T12:00:00Z`), {
        dateStyle: "long",
        timeZone: "Europe/Oslo",
      })
    : null;
  return (
    <section className="rounded-biso-md bg-surface-sunken p-6">
      <h2 className="type-heading-card text-ink">
        {start
          ? t("order.membershipWelcome.upcomingTitle")
          : t("order.membershipWelcome.title")}
      </h2>
      <p className="type-body-sm mt-2 text-ink-muted">
        {start
          ? t("order.membershipWelcome.upcomingDesc", { start })
          : t("order.membershipWelcome.desc")}
      </p>
      <Link
        className="type-label mt-4 inline-flex text-ink-accent underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        href="/member"
      >
        {t("order.membershipWelcome.cta")}
      </Link>
    </section>
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
  membershipStartsOn,
  pickupLocation,
}: {
  isMembershipOnly: boolean;
  isPaid: boolean;
  membershipStartsOn: string | null;
  pickupLocation: string;
}) {
  if (!isPaid) {
    return null;
  }
  return isMembershipOnly ? (
    <MembershipWelcomeCard startsOn={membershipStartsOn} />
  ) : (
    <PickupInfoCard pickupLocation={pickupLocation} />
  );
}

async function PickupInfoCard({ pickupLocation }: { pickupLocation: string }) {
  const t = await getTranslations("shop");
  return (
    <section className="rounded-biso-md bg-surface-sunken p-6">
      <h2 className="type-heading-card text-ink">{t("order.pickup.title")}</h2>
      <p className="type-body-sm mt-2 text-ink-muted">
        {t("order.pickup.desc")}
      </p>
      <p className="type-body-sm mt-3 flex items-center gap-2 text-ink">
        <MapPin
          aria-hidden="true"
          className="size-4 shrink-0 text-ink-accent"
        />
        <span className="font-semibold">{pickupLocation}</span>
      </p>
      <p className="type-body-sm mt-3 text-ink-muted">
        {t("order.pickup.emailNote")}
      </p>
    </section>
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
  const money = (value: number) => `${value.toFixed(2)} ${order.currency}`;

  return (
    <section className={PANEL}>
      <h2 className="type-heading-section text-ink">
        {t("order.items.title")}
      </h2>
      <ul className="mt-2 divide-y divide-edge">
        {items.map((item, index) => {
          const itemName = item.title || item.name || "Product";
          const itemPrice = item.unit_price ?? item.price ?? 0;
          return (
            <li
              className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 py-4"
              key={`${itemName}-${index}`}
            >
              <div className="min-w-0">
                <h3 className="type-heading-card text-ink">{itemName}</h3>
                <p className="type-body-sm mt-1 text-ink-muted">
                  {t("order.items.quantity")}: {item.quantity}
                </p>
                {item.variation_name ? (
                  <p className="type-body-sm mt-1 text-ink-muted">
                    {t("order.items.variant")}: {item.variation_name}
                  </p>
                ) : null}
                {item.custom_fields?.length ? (
                  <dl className="type-body-sm mt-2 space-y-1 text-ink-muted">
                    {item.custom_fields.map((field) => (
                      <div key={field.id}>
                        <dt className="inline font-semibold text-ink">
                          {field.label}:
                        </dt>{" "}
                        <dd className="inline">{field.value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
              </div>
              <div className="text-end">
                <p className="type-data text-ink">
                  {money(itemPrice * item.quantity)}
                </p>
                <p className="type-body-sm text-ink-muted">
                  {money(itemPrice)} {t("order.items.each")}
                </p>
              </div>
            </li>
          );
        })}
      </ul>

      <dl className="mt-2 border-edge border-t pt-3">
        <DetailRow
          label={t("order.totals.subtotal")}
          value={money(order.subtotal)}
        />
        {order.discount_total && order.discount_total > 0 ? (
          <DetailRow
            className="text-success"
            label={t("order.totals.discount")}
            value={`-${money(order.discount_total)}`}
          />
        ) : null}
      </dl>
      {order.membership_applied ? (
        <p className="type-body-sm mt-1 flex items-center gap-2 text-ink-accent">
          <CheckCircle2 aria-hidden="true" className="size-4 shrink-0" />
          {t("order.totals.memberApplied", {
            percent: order.member_discount_percent ?? 0,
          })}
        </p>
      ) : null}
      <div className="mt-3 flex items-baseline justify-between gap-4 border-edge border-t pt-4">
        <span className="type-heading-card text-ink">
          {t("order.totals.total")}
        </span>
        <span className="type-heading-section text-ink">
          {money(order.total)}
        </span>
      </div>
    </section>
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
 * The order body, wrapped by `ShopPageShell`. Kept as one component, rendered
 * once, so the screen view and the print rules have a single body to reason
 * about.
 */
async function OrderBody({
  isMembershipOnly,
  isSuccess,
  membershipStartsOn,
  order,
  orderDate,
  pickupLocation,
  rawItems,
  status,
  statusDesc,
  statusLabel,
  tone,
}: {
  isMembershipOnly: boolean;
  isSuccess: boolean;
  membershipStartsOn: string | null;
  order: Orders;
  orderDate: string;
  pickupLocation: string;
  rawItems: RawOrderItem[];
  status: string;
  statusDesc: string;
  statusLabel: string;
  tone: PillTone;
}) {
  const t = await getTranslations("shop");
  return (
    <>
      <StatusBanner isSuccess={isSuccess} order={order} />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-8">
          <section className={PANEL}>
            <h2 className="type-heading-section text-ink">
              {t("order.status.title")}
            </h2>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Pill tone={tone}>{statusLabel}</Pill>
              <span className="type-body-sm text-ink-muted">{statusDesc}</span>
            </div>
            <dl className="mt-4 border-edge border-t pt-3">
              <DetailRow label={t("order.status.date")} value={orderDate} />
              {order.payment_intent_id ? (
                <DetailRow
                  label={t("order.status.paymentId")}
                  value={
                    <span className="break-all">{order.payment_intent_id}</span>
                  }
                />
              ) : null}
            </dl>
          </section>

          <OrderItemsCard items={rawItems} order={order} />
        </div>

        <div className="space-y-6">
          <CustomerInfoCard order={order} />
          <SecondaryInfoCard
            isMembershipOnly={isMembershipOnly}
            isPaid={status === "paid"}
            membershipStartsOn={membershipStartsOn}
            pickupLocation={pickupLocation}
          />

          <div className="flex flex-col gap-3">
            <OrderActionsClient type="shop" />
            <OrderActionsClient type="print">
              <Receipt aria-hidden="true" className="size-4" />
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
  const tone = statusTone[status] ?? statusTone.pending;
  const statusLabel = t(`order.status.${statusLabelKey[status] ?? "pending"}`);
  const statusDesc = t(
    `order.status.${statusDescKey[status] ?? "pendingDesc"}`
  );

  const rawItems = getOrderItems(order) as RawOrderItem[];
  const purchaseType = resolvePurchaseType(rawItems);
  const isMembershipOnly = purchaseType === "membership";
  // A membership bought for next season grants nothing until it starts, so
  // the confirmation says when it starts rather than "you're a member now".
  const membershipStartsOn = upcomingMembershipStart(rawItems);
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
        meta={<Pill tone={tone}>{statusLabel}</Pill>}
        title={heroTitle}
      >
        <OrderBody
          isMembershipOnly={isMembershipOnly}
          isSuccess={isSuccess}
          membershipStartsOn={membershipStartsOn}
          order={order}
          orderDate={orderDate}
          pickupLocation={pickupLocation}
          rawItems={rawItems}
          status={status}
          statusDesc={statusDesc}
          statusLabel={statusLabel}
          tone={tone}
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
    <Suspense fallback={<DetailSkeleton />}>
      <OrderDetails isSuccess={isSuccess} orderId={orderId} />
    </Suspense>
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
