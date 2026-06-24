import type { Orders } from "@repo/api/types/appwrite";
import { getTranslations } from "next-intl/server";

export interface ReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
  variant?: string | null;
}

interface OrderReceiptProps {
  items: ReceiptItem[];
  order: Orders;
  orderDate: string;
  orderNumber: string;
  pickupLocation: string;
}

/**
 * Print-only receipt. Rendered hidden on screen (`hidden print:block`) and
 * revealed only when printing — see the order page, which hides the live UI with
 * `print:hidden`. Intentionally plain: navy ink on white, hairline rules, no
 * fills or motion, so it reproduces cleanly on paper and in PDF exports.
 */
export async function OrderReceipt({
  order,
  items,
  orderNumber,
  orderDate,
  pickupLocation,
}: OrderReceiptProps) {
  const t = await getTranslations("shop");
  const currency = order.currency;
  const money = (value: number) => `${value.toFixed(2)} ${currency}`;

  return (
    <div className="hidden print:block">
      <div className="mx-auto max-w-[720px] p-8 text-[#001731]">
        <header className="flex items-end justify-between border-[#001731] border-b-2 pb-4">
          <div>
            <div className="font-bold text-3xl tracking-tight">BISO</div>
            <div className="text-[#001731]/70 text-sm">
              {t("order.receipt.org")}
            </div>
          </div>
          <div className="text-right">
            <div className="font-semibold text-lg">
              {t("order.receipt.title")}
            </div>
            <div className="text-[#001731]/70 text-sm">
              {t("order.receipt.orderNo")} {orderNumber}
            </div>
            <div className="text-[#001731]/70 text-sm">
              {t("order.receipt.date")}: {orderDate}
            </div>
          </div>
        </header>

        <section className="mt-6 grid grid-cols-2 gap-6 text-sm">
          <div>
            <div className="mb-1 font-semibold uppercase tracking-wide">
              {t("order.receipt.billTo")}
            </div>
            {order.buyer_name ? <div>{order.buyer_name}</div> : null}
            {order.buyer_email ? <div>{order.buyer_email}</div> : null}
            {order.buyer_phone ? <div>{order.buyer_phone}</div> : null}
          </div>
          <div>
            <div className="mb-1 font-semibold uppercase tracking-wide">
              {t("order.receipt.pickupAt")}
            </div>
            <div>{pickupLocation}</div>
          </div>
        </section>

        <table className="mt-6 w-full border-collapse text-sm">
          <thead>
            <tr className="border-[#001731]/30 border-b text-left">
              <th className="py-2 font-semibold">{t("order.receipt.item")}</th>
              <th className="py-2 text-center font-semibold">
                {t("order.receipt.qty")}
              </th>
              <th className="py-2 text-right font-semibold">
                {t("order.receipt.unit")}
              </th>
              <th className="py-2 text-right font-semibold">
                {t("order.receipt.lineTotal")}
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr
                className="border-[#001731]/10 border-b align-top"
                key={`${item.name}-${index}`}
              >
                <td className="py-2">
                  <div className="font-medium">{item.name}</div>
                  {item.variant ? (
                    <div className="text-[#001731]/60 text-xs">
                      {item.variant}
                    </div>
                  ) : null}
                </td>
                <td className="py-2 text-center">{item.quantity}</td>
                <td className="py-2 text-right">{money(item.unitPrice)}</td>
                <td className="py-2 text-right">
                  {money(item.unitPrice * item.quantity)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <section className="mt-4 flex justify-end">
          <div className="w-64 space-y-1 text-sm">
            <div className="flex justify-between">
              <span>{t("order.receipt.subtotal")}</span>
              <span>{money(order.subtotal)}</span>
            </div>
            {order.discount_total && order.discount_total > 0 ? (
              <div className="flex justify-between">
                <span>{t("order.receipt.discount")}</span>
                <span>-{money(order.discount_total)}</span>
              </div>
            ) : null}
            <div className="mt-1 flex justify-between border-[#001731] border-t-2 pt-2 font-bold text-base">
              <span>{t("order.receipt.total")}</span>
              <span>{money(order.total)}</span>
            </div>
          </div>
        </section>

        <footer className="mt-10 border-[#001731]/20 border-t pt-4 text-center text-[#001731]/70 text-xs">
          <div className="font-medium text-[#001731]">
            {t("order.receipt.thanks")}
          </div>
          <div>{t("order.receipt.proof")}</div>
        </footer>
      </div>
    </div>
  );
}
