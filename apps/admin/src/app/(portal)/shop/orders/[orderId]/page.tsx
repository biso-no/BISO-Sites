import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { requireNavAccess } from "@/lib/authorization";
import { canViewShopOperations } from "@/lib/roles";
import {
  displayOrderStatus,
  type OrderDetail,
  type OrderDetailRefund,
  refundBlockedReason,
} from "@/lib/shop/order-detail";
import { getOrderDetail } from "../../../_actions/order-refunds";
import { OrderStatusPill } from "../../_components/shop-studio-pills";
import {
  BRAND,
  fmtNOK,
  MONO_STACK,
  normalizeLocale,
  SERIF_STACK,
} from "../../_components/shop-studio-theme";
import { RefundPanel } from "./_components/refund-panel";

/**
 * Order detail: everything the orders table cannot fit — the full line
 * breakdown with the buyer's checkout answers, the payment and settlement
 * trail, the refund history, and the refund control itself.
 *
 * `getOrderDetail` re-checks shop-operations access and campus scope, so a
 * hand-typed order id from another campus 404s rather than leaking.
 */
export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const ctx = await requireNavAccess("portal.shop");
  if (!canViewShopOperations(ctx.roles)) {
    notFound();
  }

  const { orderId } = await params;
  const order = await getOrderDetail(orderId);
  if (!order) {
    notFound();
  }

  const locale = normalizeLocale(await getLocale());
  const t = await getTranslations("adminShop.orders");
  const dateFormat = new Intl.DateTimeFormat(
    locale === "no" ? "nb-NO" : "en-GB",
    { dateStyle: "medium", timeStyle: "short" }
  );

  return (
    <div
      style={{
        color: BRAND.ink,
        margin: "0 auto",
        maxWidth: 1080,
        padding: "28px 24px 64px",
      }}
    >
      <Link
        href="/shop?tab=orders"
        style={{ color: BRAND.ink3, fontSize: 12.5, textDecoration: "none" }}
      >
        ← {t("title")}
      </Link>

      <header
        style={{
          alignItems: "flex-start",
          borderBottom: `0.5px solid ${BRAND.rule}`,
          display: "flex",
          gap: 16,
          justifyContent: "space-between",
          margin: "12px 0 24px",
          paddingBottom: 18,
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: SERIF_STACK,
              fontSize: 30,
              fontWeight: 500,
              margin: 0,
            }}
          >
            {t("detail.title", { identifier: order.id })}
          </h1>
          <p style={{ color: BRAND.ink3, fontSize: 13, margin: "6px 0 0" }}>
            {t("detail.subtitle", {
              buyer: order.buyerName ?? t("detail.guest"),
              date: dateFormat.format(new Date(order.createdAt)),
            })}
          </p>
        </div>
        <OrderStatusPill status={displayOrderStatus(order)} />
      </header>

      <div
        style={{
          display: "grid",
          gap: 20,
          gridTemplateColumns: "minmax(0, 1.6fr) minmax(280px, 1fr)",
        }}
      >
        <div style={{ display: "grid", gap: 20 }}>
          <LinesCard order={order} />
          <RefundHistoryCard
            dateFormat={dateFormat}
            emptyLabel={t("refund.historyEmpty")}
            refunds={order.refunds}
            title={t("refund.historyTitle")}
          />
        </div>

        <aside style={{ display: "grid", gap: 20 }}>
          <BuyerCard order={order} />
          <PaymentCard order={order} />
          <RefundPanel
            blockedReason={refundBlockedReason(order)}
            order={order}
          />
        </aside>
      </div>
    </div>
  );
}

function Card({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <section
      style={{
        background: BRAND.paper,
        border: `0.5px solid ${BRAND.rule}`,
        borderRadius: 12,
        padding: 18,
      }}
    >
      <h2
        style={{
          color: BRAND.ink,
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: 0.3,
          margin: "0 0 14px",
          textTransform: "uppercase",
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({
  label,
  mono,
  value,
}: {
  label: string;
  mono?: boolean;
  value: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "grid",
        gap: 10,
        gridTemplateColumns: "minmax(96px, 38%) 1fr",
        padding: "5px 0",
      }}
    >
      <span style={{ color: BRAND.ink3, fontSize: 12.5 }}>{label}</span>
      <span
        style={{
          color: BRAND.ink2,
          fontFamily: mono ? MONO_STACK : undefined,
          fontSize: mono ? 11.5 : 12.5,
          overflowWrap: "anywhere",
        }}
      >
        {value}
      </span>
    </div>
  );
}

async function LinesCard({ order }: { order: OrderDetail }) {
  const t = await getTranslations("adminShop.orders");

  return (
    <Card title={t("detail.itemsTitle")}>
      {order.lines.length === 0 ? (
        <p style={{ color: BRAND.ink3, fontSize: 12.5, margin: 0 }}>
          {t("detail.itemsEmpty")}
        </p>
      ) : (
        <div style={{ display: "grid", gap: 2 }}>
          {order.lines.map((line) => (
            <div
              key={line.id}
              style={{
                borderTop: `0.5px solid ${BRAND.rule}`,
                display: "grid",
                gap: 8,
                gridTemplateColumns: "1fr auto auto",
                padding: "10px 0",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ color: BRAND.ink, fontSize: 13 }}>
                  {line.name}
                </div>
                {line.variationName && (
                  <div style={{ color: BRAND.ink4, fontSize: 11.5 }}>
                    {line.variationName}
                  </div>
                )}
                {line.answers.length > 0 && (
                  <dl
                    style={{
                      display: "grid",
                      gap: 2,
                      gridTemplateColumns: "auto 1fr",
                      margin: "6px 0 0",
                    }}
                  >
                    {line.answers.map((answer) => (
                      <div
                        key={`${line.id}-${answer.label}`}
                        style={{ display: "contents" }}
                      >
                        <dt
                          style={{
                            color: BRAND.ink4,
                            fontSize: 11,
                            paddingRight: 8,
                          }}
                        >
                          {answer.label}
                        </dt>
                        <dd
                          style={{
                            color: BRAND.ink3,
                            fontSize: 11,
                            margin: 0,
                          }}
                        >
                          {answer.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
                {line.refundableQuantity < line.quantity && (
                  <div
                    style={{
                      color: BRAND.gold,
                      fontSize: 11,
                      marginTop: 4,
                    }}
                  >
                    {t("refund.lineRefunded", {
                      count: line.quantity - line.refundableQuantity,
                    })}
                  </div>
                )}
              </div>
              <span
                style={{
                  color: BRAND.ink3,
                  fontFamily: MONO_STACK,
                  fontSize: 11.5,
                }}
              >
                ×{line.quantity}
              </span>
              <span
                style={{
                  color: BRAND.ink2,
                  fontFamily: MONO_STACK,
                  fontSize: 12.5,
                }}
              >
                {fmtNOK(line.lineTotal)}
              </span>
            </div>
          ))}
        </div>
      )}

      <div
        style={{
          borderTop: `0.5px solid ${BRAND.rule2}`,
          marginTop: 12,
          paddingTop: 12,
        }}
      >
        <Row label={t("detail.subtotal")} mono value={fmtNOK(order.subtotal)} />
        {order.discountTotal ? (
          <Row
            label={t("detail.discount")}
            mono
            value={`−${fmtNOK(order.discountTotal)}`}
          />
        ) : null}
        <Row label={t("detail.total")} mono value={fmtNOK(order.total)} />
        {order.refundedTotal > 0 && (
          <Row
            label={t("refund.refundedLabel")}
            mono
            value={`−${fmtNOK(order.refundedTotal)}`}
          />
        )}
      </div>
    </Card>
  );
}

async function BuyerCard({ order }: { order: OrderDetail }) {
  const t = await getTranslations("adminShop.orders");

  return (
    <Card title={t("detail.section.customer")}>
      <Row
        label={t("detail.customerName")}
        value={order.buyerName ?? t("detail.guest")}
      />
      <Row label={t("detail.customerEmail")} value={order.buyerEmail ?? "—"} />
      <Row label={t("detail.customerPhone")} value={order.buyerPhone ?? "—"} />
      {order.membershipApplied && (
        <Row
          label={t("refund.memberDiscount")}
          value={
            order.memberDiscountPercent
              ? `${order.memberDiscountPercent}%`
              : "—"
          }
        />
      )}
    </Card>
  );
}

async function PaymentCard({ order }: { order: OrderDetail }) {
  const t = await getTranslations("adminShop.orders");

  return (
    <Card title={t("detail.section.orderDetails")}>
      <Row
        label={t("details.paymentMethod")}
        value={order.paymentProvider ?? "—"}
      />
      <Row
        label={t("refund.sessionId")}
        mono
        value={order.paymentSessionId ?? "—"}
      />
      <Row
        label={t("refund.intentId")}
        mono
        value={order.paymentIntentId ?? "—"}
      />
      <Row
        label={t("refund.ledger")}
        mono
        value={order.finagoTransactionId ?? "—"}
      />
      {order.isMembership && (
        <Row
          label={t("refund.membershipInvoice")}
          mono
          value={order.membershipInvoiceId ?? "—"}
        />
      )}
      {order.receiptUrl ? (
        <Row
          label={t("detail.openReceipt")}
          value={
            <a
              href={order.receiptUrl}
              rel="noopener noreferrer"
              style={{ color: BRAND.sky }}
              target="_blank"
            >
              {t("detail.viewFull")}
            </a>
          }
        />
      ) : null}
    </Card>
  );
}

function RefundHistoryCard({
  dateFormat,
  emptyLabel,
  refunds,
  title,
}: {
  dateFormat: Intl.DateTimeFormat;
  emptyLabel: string;
  refunds: OrderDetailRefund[];
  title: string;
}) {
  return (
    <Card title={title}>
      {refunds.length === 0 ? (
        <p style={{ color: BRAND.ink3, fontSize: 12.5, margin: 0 }}>
          {emptyLabel}
        </p>
      ) : (
        <div style={{ display: "grid", gap: 2 }}>
          {refunds.map((refund) => (
            <div
              key={refund.id}
              style={{
                borderTop: `0.5px solid ${BRAND.rule}`,
                display: "grid",
                gap: 4,
                padding: "10px 0",
              }}
            >
              <div
                style={{
                  alignItems: "baseline",
                  display: "flex",
                  gap: 10,
                  justifyContent: "space-between",
                }}
              >
                <span
                  style={{
                    color:
                      refund.status === "failed" ? BRAND.claret : BRAND.ink,
                    fontFamily: MONO_STACK,
                    fontSize: 13,
                  }}
                >
                  −{fmtNOK(refund.amount)}
                </span>
                <span style={{ color: BRAND.ink4, fontSize: 11.5 }}>
                  {refund.createdAt
                    ? dateFormat.format(new Date(refund.createdAt))
                    : "—"}
                </span>
              </div>
              <div style={{ color: BRAND.ink3, fontSize: 11.5 }}>
                {[
                  refund.status,
                  refund.createdByName,
                  refund.reason,
                  refund.lines
                    .map((line) => `${line.quantity}× ${line.name}`)
                    .join(", "),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
              {refund.error && (
                <div style={{ color: BRAND.claret, fontSize: 11 }}>
                  {refund.error}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
