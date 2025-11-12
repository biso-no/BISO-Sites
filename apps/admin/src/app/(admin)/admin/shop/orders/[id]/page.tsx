import { getOrder } from '@/app/actions/orders'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default async function AdminOrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const order: any = await getOrder(id)
  if (!order) return notFound()

  const items = (() => { try { return JSON.parse(order.items_json || '[]') } catch { return [] } })() as any[]

  return (
    <div className="p-4 grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Order {order.$id}</CardTitle>
          <CardDescription>Placed {new Date(order.$createdAt).toLocaleString()}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Status</span>
            <Badge>{order.status}</Badge>
          </div>
          <div className="text-sm">
            <div>Buyer: {order.buyer_name || 'Guest'}</div>
            <div>Email: {order.buyer_email || '-'}</div>
            <div>Phone: {order.buyer_phone || '-'}</div>
          </div>
          <div className="text-sm">
            <div>Subtotal: {Number(order.subtotal || 0).toFixed(2)} NOK</div>
            <div>Discount: {Number(order.discount_total || 0).toFixed(2)} NOK</div>
            <div className="font-medium">Total: {Number(order.total || 0).toFixed(2)} NOK</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.map((it) => {
            const customFields = Array.isArray(it.custom_fields) ? it.custom_fields : []
            const fallbackFields = !customFields.length && it.custom_field_responses
              ? Object.entries(it.custom_field_responses as Record<string, string>).map(([key, value]) => ({
                  id: key,
                  label: key,
                  value,
                }))
              : []

            return (
              <div key={`${it.product_id}-${it.variation_id || 'base'}`} className="rounded-lg border p-4 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">{it.title}</div>
                    {it.variation_name ? (
                      <div className="text-xs text-muted-foreground">Variation: {it.variation_name}</div>
                    ) : null}
                    <div className="text-xs text-muted-foreground">Quantity: {it.quantity}</div>
                  </div>
                  <div className="text-right font-semibold">{Number(it.unit_price).toFixed(2)} NOK</div>
                </div>
                {customFields.length > 0 ? (
                  <div className="mt-3 rounded-md bg-muted/40 p-3 text-xs">
                    <div className="mb-1 font-semibold text-muted-foreground">Customer input</div>
                    <ul className="space-y-1">
                      {customFields.map((field) => (
                        <li key={field.id}>
                          <span className="font-medium text-foreground">{field.label}:</span> {field.value}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {!customFields.length && fallbackFields.length > 0 ? (
                  <div className="mt-3 rounded-md bg-muted/40 p-3 text-xs">
                    <div className="mb-1 font-semibold text-muted-foreground">Customer input</div>
                    <ul className="space-y-1">
                      {fallbackFields.map((field) => (
                        <li key={field.id}>
                          <span className="font-medium text-foreground">{field.label}:</span> {field.value}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            )
          })}
          {items.length === 0 ? <div className="text-sm text-muted-foreground">No items</div> : null}
        </CardContent>
      </Card>
    </div>
  )
}

