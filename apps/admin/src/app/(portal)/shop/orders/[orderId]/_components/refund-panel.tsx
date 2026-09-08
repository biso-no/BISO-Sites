"use client";

/**
 * The refund control for one order.
 *
 * Two ways to say the same thing: pick quantities per line (the common case —
 * a returned item), or type a free amount (goodwill, shipping, a partial
 * discount after the fact). Line mode computes the amount so the two can never
 * disagree; free mode carries no lines, which is why it cannot restock.
 */

import { useTranslations } from "next-intl";
import { useMemo, useState, useTransition } from "react";
import type { OrderDetail, RefundBlockedReason } from "@/lib/shop/order-detail";
import { refundOrderAction } from "../../../../_actions/order-refunds";
import {
  BRAND,
  fmtNOK,
  MONO_STACK,
} from "../../../_components/shop-studio-theme";

type Mode = "lines" | "amount";

const MAX_REASON_LENGTH = 500;

export function RefundPanel({
  blockedReason,
  order,
}: {
  blockedReason: RefundBlockedReason | null;
  order: OrderDetail;
}) {
  const t = useTranslations("adminShop.orders.refund");
  const [mode, setMode] = useState<Mode>("lines");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [restock, setRestock] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const refundableLines = order.lines.filter(
    (line) => line.refundableQuantity > 0
  );

  const lineTotal = useMemo(
    () =>
      order.lines.reduce(
        (sum, line) => sum + (quantities[line.id] ?? 0) * line.unitPrice,
        0
      ),
    [order.lines, quantities]
  );

  const parsedAmount = Number.parseFloat(amount.replace(",", "."));
  const requestedAmount = mode === "lines" ? lineTotal : parsedAmount;
  const amountIsValid =
    Number.isFinite(requestedAmount) &&
    requestedAmount > 0 &&
    // Compared in øre: summing prices as doubles makes "refund the rest"
    // land a hundredth over the balance and fail its own check.
    Math.round(requestedAmount * 100) <= Math.round(order.refundable * 100);

  if (blockedReason) {
    return (
      <Section title={t("title")}>
        <p style={{ color: BRAND.ink3, fontSize: 13, margin: 0 }}>
          {t(`blocked.${blockedReason}`)}
        </p>
        {order.refundedTotal > 0 && (
          <p style={{ color: BRAND.ink3, fontSize: 12.5, marginTop: 8 }}>
            {t("refundedToDate", { amount: fmtNOK(order.refundedTotal) })}
          </p>
        )}
      </Section>
    );
  }

  const submit = () => {
    setError(null);
    setNotice(null);

    const lines =
      mode === "lines"
        ? Object.entries(quantities)
            .filter(([, quantity]) => quantity > 0)
            .map(([orderItemId, quantity]) => ({ orderItemId, quantity }))
        : undefined;

    startTransition(async () => {
      const result = await refundOrderAction({
        amount: mode === "amount" ? requestedAmount : undefined,
        lines,
        orderId: order.id,
        reason: reason.trim() || undefined,
        // A free-amount refund names no product, so there is nothing to return
        // to stock even if the operator ticked the box before switching mode.
        restock: mode === "lines" ? restock : false,
      });

      if (result.success) {
        setNotice(t("success", { amount: fmtNOK(result.amount) }));
        setQuantities({});
        setAmount("");
        setReason("");
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <Section title={t("title")}>
      <p style={{ color: BRAND.ink3, fontSize: 12.5, margin: "0 0 14px" }}>
        {t("refundableOf", {
          refundable: fmtNOK(order.refundable),
          total: fmtNOK(order.total),
        })}
      </p>

      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        <ModeButton
          active={mode === "lines"}
          label={t("modeLines")}
          onClick={() => setMode("lines")}
        />
        <ModeButton
          active={mode === "amount"}
          label={t("modeAmount")}
          onClick={() => setMode("amount")}
        />
      </div>

      {mode === "lines" ? (
        <LineSteppers
          emptyLabel={t("nothingLeftOnLines")}
          lines={refundableLines}
          onChange={(id, quantity) =>
            setQuantities((prev) => ({ ...prev, [id]: quantity }))
          }
          quantities={quantities}
        />
      ) : (
        <label
          htmlFor="refund-amount"
          style={{ display: "block", marginBottom: 12 }}
        >
          <span style={{ color: BRAND.ink3, display: "block", fontSize: 12 }}>
            {t("amountLabel")}
          </span>
          <input
            id="refund-amount"
            inputMode="decimal"
            max={order.refundable}
            min={0}
            onChange={(event) => setAmount(event.target.value)}
            step="0.01"
            style={inputStyle}
            type="number"
            value={amount}
          />
        </label>
      )}

      <label htmlFor="refund-reason" style={{ display: "block", marginTop: 4 }}>
        <span style={{ color: BRAND.ink3, display: "block", fontSize: 12 }}>
          {t("reasonLabel")}
        </span>
        <input
          id="refund-reason"
          maxLength={MAX_REASON_LENGTH}
          onChange={(event) => setReason(event.target.value)}
          placeholder={t("reasonPlaceholder")}
          style={inputStyle}
          type="text"
          value={reason}
        />
      </label>

      {mode === "lines" && (
        <label
          htmlFor="refund-restock"
          style={{
            alignItems: "center",
            color: BRAND.ink2,
            display: "flex",
            fontSize: 12.5,
            gap: 8,
            marginTop: 12,
          }}
        >
          <input
            checked={restock}
            id="refund-restock"
            onChange={(event) => setRestock(event.target.checked)}
            type="checkbox"
          />
          {t("restockLabel")}
        </label>
      )}

      {order.isMembership && (
        <p style={{ color: BRAND.ink3, fontSize: 12, marginTop: 12 }}>
          {t("membershipLedgerNote")}
        </p>
      )}

      <div
        style={{
          alignItems: "center",
          display: "flex",
          gap: 12,
          marginTop: 16,
        }}
      >
        <button
          disabled={!amountIsValid || isPending}
          onClick={submit}
          style={{
            background:
              amountIsValid && !isPending ? BRAND.claret : BRAND.rule2,
            border: "none",
            borderRadius: 8,
            color: "#fff",
            cursor: amountIsValid && !isPending ? "pointer" : "not-allowed",
            fontSize: 13,
            padding: "9px 16px",
          }}
          type="button"
        >
          {isPending
            ? t("submitting")
            : t("submit", {
                amount: amountIsValid ? fmtNOK(requestedAmount) : "—",
              })}
        </button>
      </div>

      {error && (
        <p style={{ color: BRAND.claret, fontSize: 12.5, marginTop: 12 }}>
          {error}
        </p>
      )}
      {notice && (
        <p style={{ color: BRAND.leaf, fontSize: 12.5, marginTop: 12 }}>
          {notice}
        </p>
      )}
    </Section>
  );
}

const inputStyle = {
  background: "#fff",
  border: `0.5px solid ${BRAND.rule2}`,
  borderRadius: 7,
  color: BRAND.ink,
  fontFamily: MONO_STACK,
  fontSize: 13,
  marginTop: 4,
  padding: "8px 10px",
  width: "100%",
} as const;

function ModeButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? BRAND.paper3 : "transparent",
        border: `0.5px solid ${active ? BRAND.rule2 : BRAND.rule}`,
        borderRadius: 999,
        color: active ? BRAND.ink : BRAND.ink3,
        cursor: "pointer",
        fontSize: 12,
        padding: "5px 12px",
      }}
      type="button"
    >
      {label}
    </button>
  );
}

function LineSteppers({
  emptyLabel,
  lines,
  onChange,
  quantities,
}: {
  emptyLabel: string;
  lines: OrderDetail["lines"];
  onChange: (id: string, quantity: number) => void;
  quantities: Record<string, number>;
}) {
  if (lines.length === 0) {
    return (
      <p style={{ color: BRAND.ink3, fontSize: 12.5, margin: "0 0 12px" }}>
        {emptyLabel}
      </p>
    );
  }

  return (
    <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
      {lines.map((line) => (
        <div
          key={line.id}
          style={{
            alignItems: "center",
            display: "grid",
            gap: 10,
            gridTemplateColumns: "1fr auto auto",
          }}
        >
          <span
            style={{
              color: BRAND.ink2,
              fontSize: 12.5,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={line.name}
          >
            {line.name}
          </span>
          <span
            style={{
              color: BRAND.ink4,
              fontFamily: MONO_STACK,
              fontSize: 11.5,
            }}
          >
            {fmtNOK(line.unitPrice)}
          </span>
          <input
            aria-label={line.name}
            max={line.refundableQuantity}
            min={0}
            onChange={(event) =>
              onChange(
                line.id,
                Math.max(
                  0,
                  Math.min(
                    line.refundableQuantity,
                    Number.parseInt(event.target.value, 10) || 0
                  )
                )
              )
            }
            style={{
              ...inputStyle,
              marginTop: 0,
              textAlign: "right",
              width: 76,
            }}
            type="number"
            value={quantities[line.id] ?? 0}
          />
        </div>
      ))}
    </div>
  );
}

function Section({
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
          margin: "0 0 12px",
          textTransform: "uppercase",
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}
