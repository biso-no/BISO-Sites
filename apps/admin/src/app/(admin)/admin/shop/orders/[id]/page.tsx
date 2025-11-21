import { Badge } from "@repo/ui/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getOrder } from "@/app/actions/orders";

export default async function AdminOrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations("adminShop");
  const order: any = await getOrder(id);
  if (!order) return notFound();

  const items = (() => {
    try {
      return JSON.parse(order.items_json || "[]");
    } catch {
      return [];
    }
  })() as any[];

  return (
    <div className="p-4 grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>{t("orders.detail.title", { identifier: order.$id })}</CardTitle>
          <CardDescription>
            {t("orders.detail.subtitle", {
              date: new Date(order.$createdAt).toLocaleString(),
              buyer: order.buyer_name || t("orders.detail.guest"),
            })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {t("orders.detail.labels.status")}
            </span>
            <Badge>{order.status}</Badge>
          </div>
          <div className="text-sm">
            <div>
              {t("orders.detail.labels.buyer")}: {order.buyer_name || t("orders.detail.guest")}
            </div>
            <div>
              {t("orders.detail.labels.email")}: {order.buyer_email || "-"}
            </div>
            <div>
              {t("orders.detail.labels.phone")}: {order.buyer_phone || "-"}
            </div>
          </div>
          <div className="text-sm">
            <div>
              {t("orders.detail.subtotal")}: {Number(order.subtotal || 0).toFixed(2)} NOK
            </div>
            <div>
              {t("orders.detail.discount")}: {Number(order.discount_total || 0).toFixed(2)} NOK
            </div>
            <div className="font-medium">
              {t("orders.detail.total")}: {Number(order.total || 0).toFixed(2)} NOK
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("orders.detail.itemsTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.map((it) => {
            const customFields = Array.isArray(it.custom_fields) ? it.custom_fields : [];
            const fallbackFields =
              !customFields.length && it.custom_field_responses
                ? Object.entries(it.custom_field_responses as Record<string, string>).map(
                    ([key, value]) => ({
                      id: key,
                      label: key,
                      value,
                    }),
                  )
                : [];

            return (
              <div
                key={`${it.product_id}-${it.variation_id || "base"}`}
                className="rounded-lg border p-4 text-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">{it.title || it.product_slug}</div>
                    {it.variation_name ? (
                      <div className="text-xs text-muted-foreground">
                        {t("orders.details.variation")}: {it.variation_name}
                      </div>
                    ) : null}
                    <div className="text-xs text-muted-foreground">
                      {t("orders.details.quantity")}: {it.quantity}
                    </div>
                  </div>
                  <div className="text-right font-semibold">
                    {Number(it.unit_price).toFixed(2)} NOK
                  </div>
                </div>
                {customFields.length > 0 ? (
                  <div className="mt-3 rounded-md bg-muted/40 p-3 text-xs">
                    <div className="mb-1 font-semibold text-muted-foreground">
                      {t("orders.details.customerInput")}
                    </div>
                    <ul className="space-y-1">
                      {customFields.map((field) => (
                        <li key={field.id}>
                          <span className="font-medium text-foreground">{field.label}:</span>{" "}
                          {field.value}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {!customFields.length && fallbackFields.length > 0 ? (
                  <div className="mt-3 rounded-md bg-muted/40 p-3 text-xs">
                    <div className="mb-1 font-semibold text-muted-foreground">
                      {t("orders.details.customerInput")}
                    </div>
                    <ul className="space-y-1">
                      {fallbackFields.map((field) => (
                        <li key={field.id}>
                          <span className="font-medium text-foreground">{field.label}:</span>{" "}
                          {field.value}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            );
          })}
          {items.length === 0 ? (
            <div className="text-sm text-muted-foreground">{t("orders.details.noItems")}</div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
