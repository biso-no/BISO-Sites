import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { Progress } from "@repo/ui/components/ui/progress";
import { Separator } from "@repo/ui/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@repo/ui/components/ui/tabs";
import { ListFilter } from "lucide-react";

import { getTranslations } from "next-intl/server";

export const description =
  "Monitor Vipps orders, revenue trends, and customer details in real time.";

import type { Orders } from "@repo/api/types/appwrite";
import { cn } from "@repo/ui/lib/utils";
import NextLink from "next/link";
import { getOrders } from "@/app/actions/orders";
import { OrderExportPopover } from "./_components/order-export";

type PreparedOrder = Orders & {
  createdAtDate: Date;
  totalValue: number;
};

type Translator = Awaited<ReturnType<typeof getTranslations>>;

type OrdersTableLabels = {
  customer: string;
  email: string;
  status: string;
  date: string;
  amount: string;
  view: string;
};

const NOK_FORMATTER = new Intl.NumberFormat("nb-NO", {
  style: "currency",
  currency: "NOK",
});

const DATE_FORMATTER = new Intl.DateTimeFormat("nb-NO", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const STATUS_STYLES: Record<string, string> = {
  paid: "border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
  authorized:
    "border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
  pending:
    "border-transparent bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-100",
  cancelled:
    "border-transparent bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-100",
  failed:
    "border-transparent bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-100",
  refunded:
    "border-transparent bg-slate-200 text-slate-700 dark:bg-slate-500/20 dark:text-slate-200",
};

export default async function Dashboard() {
  const rawOrders = (await getOrders({ limit: 200 })) as Orders[];
  const orders: PreparedOrder[] = rawOrders.map((order) => ({
    ...order,
    createdAtDate: new Date(order.$createdAt),
    totalValue: Number(order.total ?? 0),
  }));
  const t = await getTranslations("adminShop");

  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(startOfWeek.getDate() - 7);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  const ordersWeek = filterByStart(orders, startOfWeek);
  const ordersMonth = filterByStart(orders, startOfMonth);
  const ordersYear = filterByStart(orders, startOfYear);

  const revenueWeek = sumTotals(ordersWeek);
  const revenueMonth = sumTotals(ordersMonth);
  const revenueYear = sumTotals(ordersYear);

  const weekProgress = calculateProgress(revenueWeek, revenueMonth);
  const monthProgress = calculateProgress(revenueMonth, revenueYear);

  const featuredOrder = orders[0] ?? null;
  const overviewDescription = orders.length
    ? t("orders.analytics.syncedFromVipps", { count: orders.length })
    : t("orders.analytics.overviewEmpty");
  const tableLabels: OrdersTableLabels = {
    customer: t("orders.table.customer"),
    email: t("orders.table.email"),
    status: t("orders.table.status"),
    date: t("orders.table.date"),
    amount: t("orders.table.amount"),
    view: t("orders.table.view"),
  };
  const statusOptions = [
    "paid",
    "authorized",
    "pending",
    "cancelled",
    "failed",
    "refunded",
  ];

  return (
    <div className="flex w-full flex-col">
      <main className="grid flex-1 items-start gap-4 md:gap-8 lg:grid-cols-3 xl:grid-cols-3">
        <div className="grid auto-rows-max items-start gap-4 md:gap-8 lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
            <Card
              className="glass-panel sm:col-span-2"
              x-chunk="dashboard-05-chunk-0"
            >
              <CardHeader className="pb-3">
                <CardTitle>{t("orders.analytics.overviewTitle")}</CardTitle>
                <CardDescription className="max-w-lg text-balance leading-relaxed">
                  {overviewDescription}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="font-semibold text-3xl">
                  {NOK_FORMATTER.format(revenueYear)}
                </div>
                <p className="text-muted-foreground text-xs">
                  {t("orders.analytics.totalVolumeSince", {
                    date: DATE_FORMATTER.format(startOfYear),
                  })}
                </p>
              </CardContent>
              <CardFooter>
                <Button asChild variant="outline">
                  <NextLink href="/shop">
                    {t("orders.actions.openStore")}
                  </NextLink>
                </Button>
              </CardFooter>
            </Card>
            <Card className="glass-panel" x-chunk="dashboard-05-chunk-1">
              <CardHeader className="pb-2">
                <CardDescription>
                  {t("orders.analytics.weekTitle")}
                </CardDescription>
                <CardTitle className="text-3xl">
                  {NOK_FORMATTER.format(revenueWeek)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-muted-foreground text-xs">
                  {t("orders.analytics.weekOrders", {
                    count: ordersWeek.length,
                  })}
                </div>
              </CardContent>
              <CardFooter>
                <Progress
                  aria-label={t("orders.analytics.weekTitle")}
                  value={weekProgress}
                />
              </CardFooter>
            </Card>
            <Card className="glass-panel" x-chunk="dashboard-05-chunk-2">
              <CardHeader className="pb-2">
                <CardDescription>
                  {t("orders.analytics.monthTitle")}
                </CardDescription>
                <CardTitle className="text-3xl">
                  {NOK_FORMATTER.format(revenueMonth)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-muted-foreground text-xs">
                  {t("orders.analytics.monthOrders", {
                    count: ordersMonth.length,
                    date: DATE_FORMATTER.format(startOfMonth),
                  })}
                </div>
              </CardContent>
              <CardFooter>
                <Progress
                  aria-label={t("orders.analytics.monthTitle")}
                  value={monthProgress}
                />
              </CardFooter>
            </Card>
          </div>
          <Tabs defaultValue="week">
            <div className="flex items-center">
              <TabsList>
                <TabsTrigger value="week">
                  {t("orders.analytics.tabsWeek")}
                </TabsTrigger>
                <TabsTrigger value="month">
                  {t("orders.analytics.tabsMonth")}
                </TabsTrigger>
                <TabsTrigger value="year">
                  {t("orders.analytics.tabsYear")}
                </TabsTrigger>
              </TabsList>
              <div className="ml-auto flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      className="h-7 gap-1 text-sm"
                      size="sm"
                      variant="outline"
                    >
                      <ListFilter className="h-3.5 w-3.5" />
                      <span className="sr-only sm:not-sr-only">
                        {t("orders.analytics.filterButtonLabel")}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>
                      {t("orders.analytics.filtersStatusLabel")}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {statusOptions.map((status) => (
                      <DropdownMenuCheckboxItem key={status}>
                        {t(`orders.status.${status}`)}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <OrderExportPopover />
              </div>
            </div>
            <TabsContent value="week">
              <OrdersTable
                description={t("orders.analytics.weekDescription")}
                emptyMessage={t("orders.analytics.weekEmpty")}
                labels={tableLabels}
                orders={ordersWeek}
                t={t}
                title={t("orders.analytics.weekTitle")}
              />
            </TabsContent>
            <TabsContent value="month">
              <OrdersTable
                description={t("orders.analytics.monthDescription")}
                emptyMessage={t("orders.analytics.monthEmpty")}
                labels={tableLabels}
                orders={ordersMonth}
                t={t}
                title={t("orders.analytics.monthTitle")}
              />
            </TabsContent>
            <TabsContent value="year">
              <OrdersTable
                description={t("orders.analytics.yearDescription")}
                emptyMessage={t("orders.analytics.yearEmpty")}
                labels={tableLabels}
                orders={ordersYear}
                t={t}
                title={t("orders.analytics.tabsYear")}
              />
            </TabsContent>
          </Tabs>
        </div>
        <div>
          <OrderDetailCard order={featuredOrder} t={t} />
        </div>
      </main>
    </div>
  );
}

type OrdersTableProps = {
  orders: PreparedOrder[];
  title: string;
  description: string;
  emptyMessage: string;
  labels: OrdersTableLabels;
  t: Translator;
};

function OrdersTable({
  orders,
  title,
  description,
  emptyMessage,
  labels,
  t,
}: OrdersTableProps) {
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
              <TableHead>{labels.customer}</TableHead>
              <TableHead className="hidden sm:table-cell">
                {labels.email}
              </TableHead>
              <TableHead className="hidden sm:table-cell">
                {labels.status}
              </TableHead>
              <TableHead className="hidden md:table-cell">
                {labels.date}
              </TableHead>
              <TableHead className="text-right">{labels.amount}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => {
              const status = (order.status || "pending").toLowerCase();
              const statusClasses =
                STATUS_STYLES[status] || STATUS_STYLES.pending;
              const statusLabel = t(`orders.status.${status}`);
              return (
                <TableRow key={order.$id}>
                  <TableCell>
                    <div className="font-medium">
                      {order.buyer_name || t("orders.detail.guest")}
                    </div>
                    <div className="hidden text-muted-foreground text-sm md:inline">
                      {order.buyer_email || "—"}
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {order.buyer_email || "—"}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge className={cn("text-xs capitalize", statusClasses)}>
                      {statusLabel}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {DATE_FORMATTER.format(order.createdAtDate)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span>{NOK_FORMATTER.format(order.totalValue)}</span>
                      <NextLink
                        className="text-xs underline"
                        href={`/admin/shop/orders/${order.$id}`}
                      >
                        {labels.view}
                      </NextLink>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {orders.length === 0 && (
              <TableRow>
                <TableCell
                  className="py-6 text-center text-muted-foreground text-sm"
                  colSpan={5}
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function OrderDetailCard({
  order,
  t,
}: {
  order: PreparedOrder | null;
  t: Translator;
}) {
  if (!order) {
    return (
      <Card className="glass-panel" x-chunk="dashboard-05-chunk-4">
        <CardHeader>
          <CardTitle>{t("orders.detail.emptyTitle")}</CardTitle>
          <CardDescription>
            {t("orders.detail.emptyDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          {t("orders.detail.emptyMessage")}
        </CardContent>
      </Card>
    );
  }

  const status = (order.status || "pending").toLowerCase();
  const statusClasses = STATUS_STYLES[status] || STATUS_STYLES.pending;
  const statusLabel = t(`orders.status.${status}`);
  const items = parseOrderItems(order.items_json);
  const subtotal =
    typeof order.subtotal === "number" ? order.subtotal : order.totalValue;
  const discount = Number(order.discount_total ?? 0);
  const total = order.totalValue;

  return (
    <Card
      className="glass-panel overflow-hidden"
      x-chunk="dashboard-05-chunk-4"
    >
      <CardHeader className="flex flex-col gap-3 bg-muted/50">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle>
              {t("orders.detail.title", { identifier: order.$id.slice(-8) })}
            </CardTitle>
            <CardDescription>
              {t("orders.detail.subtitle", {
                date: DATE_FORMATTER.format(order.createdAtDate),
                buyer: order.buyer_name || t("orders.detail.guest"),
              })}
            </CardDescription>
          </div>
          <Badge className={cn("capitalize", statusClasses)}>
            {statusLabel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 p-6 text-sm">
        <div className="space-y-3">
          <div className="font-semibold">
            {t("orders.detail.section.orderDetails")}
          </div>
          <ul className="grid gap-3">
            {items.length === 0 && (
              <li className="text-muted-foreground">
                {t("orders.detail.itemsEmpty")}
              </li>
            )}
            {items.map((item) => (
              <li
                className="flex items-center justify-between gap-4"
                key={`${item.product_id}-${item.variation_id ?? "base"}`}
              >
                <span className="text-muted-foreground">
                  {item.title ||
                    item.product_slug ||
                    t("orders.detail.productFallback")}{" "}
                  {item.quantity ? (
                    <span className="text-muted-foreground text-xs">
                      x {item.quantity}
                    </span>
                  ) : null}
                </span>
                <span>
                  {NOK_FORMATTER.format(
                    item.quantity && item.unit_price
                      ? item.quantity * item.unit_price
                      : (item.unit_price ?? 0)
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <Separator />
        <ul className="grid gap-2 text-sm">
          <li className="flex items-center justify-between">
            <span className="text-muted-foreground">
              {t("orders.detail.subtotal")}
            </span>
            <span>{NOK_FORMATTER.format(subtotal)}</span>
          </li>
          <li className="flex items-center justify-between">
            <span className="text-muted-foreground">
              {t("orders.detail.discount")}
            </span>
            <span>
              {discount
                ? `- ${NOK_FORMATTER.format(discount)}`
                : NOK_FORMATTER.format(0)}
            </span>
          </li>
          <li className="flex items-center justify-between font-semibold">
            <span className="text-muted-foreground">
              {t("orders.detail.total")}
            </span>
            <span>{NOK_FORMATTER.format(total)}</span>
          </li>
        </ul>
        <Separator />
        <div className="space-y-2">
          <div className="font-semibold">
            {t("orders.detail.section.customer")}
          </div>
          <dl className="grid gap-2 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">
                {t("orders.detail.customerName")}
              </dt>
              <dd>{order.buyer_name || t("orders.detail.guest")}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">
                {t("orders.detail.customerEmail")}
              </dt>
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
              <dt className="text-muted-foreground">
                {t("orders.detail.customerPhone")}
              </dt>
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
        <div className="text-muted-foreground text-xs">
          {t("orders.detail.lastUpdated", {
            date: DATE_FORMATTER.format(order.createdAtDate),
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <NextLink href={`/admin/shop/orders/${order.$id}`}>
              {t("orders.detail.viewFull")}
            </NextLink>
          </Button>
          {order.vipps_payment_link && (
            <Button asChild size="sm" variant="outline">
              <a
                href={order.vipps_payment_link}
                rel="noreferrer"
                target="_blank"
              >
                {t("orders.detail.openReceipt")}
              </a>
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}

type ParsedOrderItem = {
  product_id?: string;
  product_slug?: string;
  title?: string;
  quantity?: number;
  unit_price?: number;
  variation_id?: string;
};

function parseOrderItems(itemsJson?: string | null): ParsedOrderItem[] {
  if (!itemsJson) {
    return [];
  }
  try {
    const parsed = JSON.parse(itemsJson);
    if (Array.isArray(parsed)) {
      return parsed as ParsedOrderItem[];
    }
    return [];
  } catch {
    return [];
  }
}

function filterByStart(orders: PreparedOrder[], startDate: Date) {
  return orders.filter((order) => order.createdAtDate >= startDate);
}

function sumTotals(orders: PreparedOrder[]) {
  return orders.reduce((sum, order) => sum + order.totalValue, 0);
}

function calculateProgress(part: number, whole: number) {
  if (part <= 0 || whole <= 0) {
    return 0;
  }
  return Math.min(100, Number(((part / whole) * 100).toFixed(1)));
}
