import { ListFilter } from "lucide-react"

import { Badge } from "@repo/ui/components/ui/badge"
import { Button } from "@repo/ui/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu"
import { Progress } from "@repo/ui/components/ui/progress"
import { Separator } from "@repo/ui/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/ui/table"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@repo/ui/components/ui/tabs"

export const description =
  "Monitor Vipps orders, revenue trends, and customer details in real time."

import { cn } from "@repo/ui/lib/utils"
import { getOrders } from '@/app/actions/orders'
import NextLink from 'next/link'
import { Orders } from "@repo/api/types/appwrite"
import { OrderExportPopover } from "./_components/order-export"

type PreparedOrder = Orders & {
  createdAtDate: Date
  totalValue: number
}

const NOK_FORMATTER = new Intl.NumberFormat("nb-NO", {
  style: "currency",
  currency: "NOK",
})

const DATE_FORMATTER = new Intl.DateTimeFormat("nb-NO", {
  day: "numeric",
  month: "short",
  year: "numeric",
})

const STATUS_STYLES: Record<string, string> = {
  paid: "border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
  authorized: "border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
  pending: "border-transparent bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-100",
  cancelled: "border-transparent bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-100",
  failed: "border-transparent bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-100",
  refunded: "border-transparent bg-slate-200 text-slate-700 dark:bg-slate-500/20 dark:text-slate-200",
}

export default async function Dashboard() {
  const rawOrders = (await getOrders({ limit: 200 })) as Orders[]
  const orders: PreparedOrder[] = rawOrders.map((order) => ({
    ...order,
    createdAtDate: new Date(order.$createdAt),
    totalValue: Number(order.total ?? 0),
  }))

  const now = new Date()
  const startOfWeek = new Date(now)
  startOfWeek.setDate(startOfWeek.getDate() - 7)
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfYear = new Date(now.getFullYear(), 0, 1)

  const ordersWeek = filterByStart(orders, startOfWeek)
  const ordersMonth = filterByStart(orders, startOfMonth)
  const ordersYear = filterByStart(orders, startOfYear)

  const revenueWeek = sumTotals(ordersWeek)
  const revenueMonth = sumTotals(ordersMonth)
  const revenueYear = sumTotals(ordersYear)

  const weekProgress = calculateProgress(revenueWeek, revenueMonth)
  const monthProgress = calculateProgress(revenueMonth, revenueYear)

  const featuredOrder = orders[0] ?? null

  return (
    <div className="flex w-full flex-col">
      <main className="grid flex-1 items-start gap-4 md:gap-8 lg:grid-cols-3 xl:grid-cols-3">
        <div className="grid auto-rows-max items-start gap-4 md:gap-8 lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
            <Card
              className="glass-panel sm:col-span-2" x-chunk="dashboard-05-chunk-0"
            >
              <CardHeader className="pb-3">
                <CardTitle>Orders Overview</CardTitle>
                <CardDescription className="max-w-lg text-balance leading-relaxed">
                  {orders.length ? `${orders.length} order${orders.length === 1 ? "" : "s"} synced from Vipps this year.` : "Ingen ordre registrert enda."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-semibold">{NOK_FORMATTER.format(revenueYear)}</div>
                <p className="text-xs text-muted-foreground">
                  Totalt volum siden {DATE_FORMATTER.format(startOfYear)}
                </p>
              </CardContent>
              <CardFooter>
                <Button asChild variant="outline">
                  <NextLink href="/shop">Åpne nettbutikk</NextLink>
                </Button>
              </CardFooter>
            </Card>
            <Card className="glass-panel" x-chunk="dashboard-05-chunk-1">
              <CardHeader className="pb-2">
                <CardDescription>Forrige 7 dager</CardDescription>
                <CardTitle className="text-3xl">{NOK_FORMATTER.format(revenueWeek)}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xs text-muted-foreground">
                  {ordersWeek.length} ordre denne uken
                </div>
              </CardContent>
              <CardFooter>
                <Progress value={weekProgress} aria-label="Weekly contribution" />
              </CardFooter>
            </Card>
            <Card className="glass-panel" x-chunk="dashboard-05-chunk-2">
              <CardHeader className="pb-2">
                <CardDescription>Denne måneden</CardDescription>
                <CardTitle className="text-3xl">{NOK_FORMATTER.format(revenueMonth)}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xs text-muted-foreground">
                  {ordersMonth.length} ordre siden {DATE_FORMATTER.format(startOfMonth)}
                </div>
              </CardContent>
              <CardFooter>
                <Progress value={monthProgress} aria-label="Monthly share of yearly total" />
              </CardFooter>
            </Card>
          </div>
          <Tabs defaultValue="week">
            <div className="flex items-center">
              <TabsList>
                <TabsTrigger value="week">Week</TabsTrigger>
                <TabsTrigger value="month">Month</TabsTrigger>
                <TabsTrigger value="year">Year</TabsTrigger>
              </TabsList>
              <div className="ml-auto flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1 text-sm"
                    >
                      <ListFilter className="h-3.5 w-3.5" />
                      <span className="sr-only sm:not-sr-only">Filter</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Status</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {["paid", "pending", "failed", "refunded"].map((status) => (
                      <DropdownMenuCheckboxItem key={status}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <OrderExportPopover />
              </div>
            </div>
            <TabsContent value="week">
              <OrdersTable
                orders={ordersWeek}
                title="Orders"
                description="Transaksjoner fra de siste 7 dagene."
                emptyMessage="Ingen ordre registrert denne uken."
              />
            </TabsContent>
            <TabsContent value="month">
              <OrdersTable
                orders={ordersMonth}
                title="Orders"
                description="Alle ordre fra denne måneden."
                emptyMessage="Ingen ordre registrert hittil i måneden."
              />
            </TabsContent>
            <TabsContent value="year">
              <OrdersTable
                orders={ordersYear}
                title="Orders"
                description="Årets ordre historikk."
                emptyMessage="Ingen ordre registrert i år."
              />
            </TabsContent>
          </Tabs>
        </div>
        <div>
          <OrderDetailCard order={featuredOrder} />
        </div>
      </main>
    </div>
  )
}

function OrdersTable({
  orders,
  title,
  description,
  emptyMessage,
}: {
  orders: PreparedOrder[]
  title: string
  description: string
  emptyMessage: string
}) {
  return (
    <Card className="glass-panel" x-chunk="dashboard-05-chunk-3">
      <CardHeader className="px-7">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead className="hidden sm:table-cell">
                Email
              </TableHead>
              <TableHead className="hidden sm:table-cell">
                Status
              </TableHead>
              <TableHead className="hidden md:table-cell">
                Date
              </TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => {
              const status = (order.status || "pending").toLowerCase()
              const statusClasses = STATUS_STYLES[status] || STATUS_STYLES.pending
              return (
                <TableRow key={order.$id}>
                  <TableCell>
                    <div className="font-medium">{order.buyer_name || "Guest"}</div>
                    <div className="hidden text-sm text-muted-foreground md:inline">{order.buyer_email || "—"}</div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">{order.buyer_email || "—"}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge className={cn("text-xs capitalize", statusClasses)}>
                      {status}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{DATE_FORMATTER.format(order.createdAtDate)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span>{NOK_FORMATTER.format(order.totalValue)}</span>
                      <NextLink className="text-xs underline" href={`/admin/shop/orders/${order.$id}`}>View</NextLink>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
            {orders.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function OrderDetailCard({ order }: { order: PreparedOrder | null }) {
  if (!order) {
    return (
      <Card className="glass-panel" x-chunk="dashboard-05-chunk-4">
        <CardHeader>
          <CardTitle>Order details</CardTitle>
          <CardDescription>Velg en ordre for å se detaljer.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Ingen ordre tilgjengelig.
        </CardContent>
      </Card>
    )
  }

  const status = (order.status || "pending").toLowerCase()
  const statusClasses = STATUS_STYLES[status] || STATUS_STYLES.pending
  const items = parseOrderItems(order.items_json)
  const subtotal = typeof order.subtotal === "number" ? order.subtotal : order.totalValue
  const discount = Number(order.discount_total ?? 0)
  const total = order.totalValue

  return (
    <Card
      className="glass-panel overflow-hidden" x-chunk="dashboard-05-chunk-4"
    >
      <CardHeader className="flex flex-col gap-3 bg-muted/50">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle>Order #{order.$id.slice(-8)}</CardTitle>
            <CardDescription>
              Plassert {DATE_FORMATTER.format(order.createdAtDate)} av {order.buyer_name || "Guest"}
            </CardDescription>
          </div>
          <Badge className={cn("capitalize", statusClasses)}>
            {status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-6 text-sm space-y-6">
        <div className="space-y-3">
          <div className="font-semibold">Order Details</div>
          <ul className="grid gap-3">
            {items.length === 0 && (
              <li className="text-muted-foreground">Ingen ordrelinjer registrert.</li>
            )}
            {items.map((item) => (
              <li key={`${item.product_id}-${item.variation_id ?? "base"}`} className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">
                  {item.title || item.product_slug || "Produkt"}{" "}
                  {item.quantity ? <span className="text-xs text-muted-foreground">x {item.quantity}</span> : null}
                </span>
                <span>{NOK_FORMATTER.format(item.quantity && item.unit_price ? item.quantity * item.unit_price : item.unit_price ?? 0)}</span>
              </li>
            ))}
          </ul>
        </div>
        <Separator />
        <ul className="grid gap-2 text-sm">
          <li className="flex items-center justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{NOK_FORMATTER.format(subtotal)}</span>
          </li>
          <li className="flex items-center justify-between">
            <span className="text-muted-foreground">Discount</span>
            <span>{discount ? `- ${NOK_FORMATTER.format(discount)}` : NOK_FORMATTER.format(0)}</span>
          </li>
          <li className="flex items-center justify-between font-semibold">
            <span className="text-muted-foreground">Total</span>
            <span>{NOK_FORMATTER.format(total)}</span>
          </li>
        </ul>
        <Separator />
        <div className="space-y-2">
          <div className="font-semibold">Customer</div>
          <dl className="grid gap-2 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Name</dt>
              <dd>{order.buyer_name || "Guest"}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Email</dt>
              <dd>
                {order.buyer_email ? (
                  <a className="underline" href={`mailto:${order.buyer_email}`}>
                    {order.buyer_email}
                  </a>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Phone</dt>
              <dd>
                {order.buyer_phone ? (
                  <a className="underline" href={`tel:${order.buyer_phone}`}>
                    {order.buyer_phone}
                  </a>
                ) : (
                  "—"
                )}
              </dd>
            </div>
          </dl>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col gap-3 border-t bg-muted/50 px-6 py-4">
        <div className="text-xs text-muted-foreground">
          Sist oppdatert {DATE_FORMATTER.format(order.createdAtDate)}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <NextLink href={`/admin/shop/orders/${order.$id}`}>Vis full ordre</NextLink>
          </Button>
          {order.vipps_payment_link && (
            <Button asChild size="sm" variant="outline">
              <a href={order.vipps_payment_link} target="_blank" rel="noreferrer">
                Åpne Vipps-kvittering
              </a>
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  )
}

type ParsedOrderItem = {
  product_id?: string
  product_slug?: string
  title?: string
  quantity?: number
  unit_price?: number
  variation_id?: string
}

function parseOrderItems(itemsJson?: string | null): ParsedOrderItem[] {
  if (!itemsJson) return []
  try {
    const parsed = JSON.parse(itemsJson)
    if (Array.isArray(parsed)) {
      return parsed as ParsedOrderItem[]
    }
    return []
  } catch {
    return []
  }
}

function filterByStart(orders: PreparedOrder[], startDate: Date) {
  return orders.filter((order) => order.createdAtDate >= startDate)
}

function sumTotals(orders: PreparedOrder[]) {
  return orders.reduce((sum, order) => sum + order.totalValue, 0)
}

function calculateProgress(part: number, whole: number) {
  if (part <= 0 || whole <= 0) return 0
  return Math.min(100, Number(((part / whole) * 100).toFixed(1)))
}
