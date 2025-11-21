import type { Orders } from "@repo/api/types/appwrite";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/ui/components/ui/avatar";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/ui/table";
import { cn } from "@repo/ui/lib/utils";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ArrowUpRight,
  CreditCard,
  DollarSign,
  Users,
} from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getOrders } from "@/app/actions/orders";
import { getShopMetrics, type MetricTrend } from "@/app/actions/shop-metrics";

export const description =
  "An application shell with a header and main content area. The header has a navbar, a search input and and a user nav dropdown. The user nav is toggled by a button with an avatar image.";

const NOK_FORMATTER = new Intl.NumberFormat("nb-NO", {
  style: "currency",
  currency: "NOK",
  maximumFractionDigits: 0,
});

const NUMBER_FORMATTER = new Intl.NumberFormat("nb-NO", {
  maximumFractionDigits: 0,
});

const PERCENT_FORMATTER = new Intl.NumberFormat("nb-NO", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
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

type Translator = Awaited<ReturnType<typeof getTranslations>>;

export default async function Dashboard() {
  const [metrics, orders] = await Promise.all([
    getShopMetrics(),
    getOrders({ limit: 12, path: "/admin/shop/orders" }),
  ]);
  const orderList = Array.isArray(orders) ? orders : [];
  const transactions = orderList.slice(0, 8);
  const recentSales = orderList.slice(0, 5);
  const t = await getTranslations("adminShop");

  return (
    <div className="flex w-full flex-col">
      <main className="flex flex-1 flex-col gap-4">
        <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
          <MetricCard
            icon={DollarSign}
            label={t("dashboard.metrics.totalRevenue")}
            value={NOK_FORMATTER.format(metrics.revenue.value)}
            trend={metrics.revenue.trend}
          />
          <MetricCard
            icon={Users}
            label={t("dashboard.metrics.productCatalog")}
            value={NUMBER_FORMATTER.format(metrics.catalog.value)}
            trend={metrics.catalog.trend}
          />
          <MetricCard
            icon={CreditCard}
            label={t("dashboard.metrics.sales")}
            value={NUMBER_FORMATTER.format(metrics.sales.value)}
            trend={metrics.sales.trend}
          />
          <MetricCard
            icon={Activity}
            label={t("dashboard.metrics.activeNow")}
            value={NUMBER_FORMATTER.format(metrics.activeCatalog.value)}
            trend={metrics.activeCatalog.trend}
          />
        </div>
        <div className="grid gap-4 md:gap-8 lg:grid-cols-2 xl:grid-cols-3">
          <Card
            className="glass-panel xl:col-span-2"
            x-chunk="dashboard-01-chunk-4"
          >
            <CardHeader className="flex flex-row items-center">
              <div className="grid gap-2">
                <CardTitle>{t("dashboard.transactions.title")}</CardTitle>
                <CardDescription>
                  {t("dashboard.transactions.description")}
                </CardDescription>
              </div>
              <Button asChild size="sm" className="ml-auto gap-1">
                <Link href="/admin/shop/orders">
                  {t("dashboard.transactions.viewAll")}
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("customers.table.name")}</TableHead>
                    <TableHead className="hidden xl:table-column">
                      {t("orders.table.orderNumber")}
                    </TableHead>
                    <TableHead className="hidden xl:table-column">
                      {t("orders.table.status")}
                    </TableHead>
                    <TableHead className="hidden xl:table-column">
                      {t("orders.table.date")}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("orders.table.amount")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((order) => {
                    const buyerName = order.buyer_name || "Guest";
                    const buyerEmail = order.buyer_email || "—";
                    const status = (order.status || "pending").toLowerCase();
                    const statusClasses =
                      STATUS_STYLES[status] ||
                      "border-transparent bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-200";
                    const createdAt = DATE_FORMATTER.format(
                      new Date(order.$createdAt)
                    );
                    const totalAmount = NOK_FORMATTER.format(
                      Number(order.total) || 0
                    );

                    return (
                      <TableRow key={order.$id}>
                        <TableCell>
                          <div className="font-medium">{buyerName}</div>
                          <div className="hidden text-sm text-muted-foreground md:inline">
                            {buyerEmail}
                          </div>
                        </TableCell>
                        <TableCell className="hidden xl:table-column text-sm text-muted-foreground">
                          #{order.$id.slice(-6)}
                        </TableCell>
                        <TableCell className="hidden xl:table-column">
                          <Badge
                            className={cn("text-xs capitalize", statusClasses)}
                          >
                            {status}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell lg:hidden xl:table-column">
                          {createdAt}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {totalAmount}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {transactions.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="py-8 text-center text-sm text-muted-foreground"
                      >
                        {t("dashboard.transactions.empty")}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <RecentSales orders={recentSales} t={t} />
        </div>
      </main>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  trend,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  trend: MetricTrend;
}) {
  return (
    <Card className="glass-panel" x-chunk="dashboard-01-chunk-0">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{formatTrend(trend)}</p>
      </CardContent>
    </Card>
  );
}

function RecentSales({ orders, t }: { orders: Orders[]; t: Translator }) {
  return (
    <Card className="glass-panel" x-chunk="dashboard-01-chunk-5">
      <CardHeader>
        <CardTitle>{t("dashboard.recentSales.title")}</CardTitle>
        <CardDescription>
          {t("dashboard.recentSales.description")}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-8">
        {orders.length === 0 && (
          <div className="text-sm text-muted-foreground">
            {t("dashboard.recentSales.empty")}
          </div>
        )}
        {orders.map((order) => {
          const buyerName = order.buyer_name || t("orders.detail.guest");
          const buyerEmail = order.buyer_email || "—";
          const amount = NOK_FORMATTER.format(Number(order.total) || 0);
          const avatarSource =
            order.buyer_name || order.buyer_email || order.$id;
          const avatarSeed = encodeURIComponent(avatarSource || "guest");
          const initials = getInitials(avatarSource || "BISO");

          return (
            <div key={order.$id} className="flex items-center gap-4">
              <Avatar className="hidden h-9 w-9 sm:flex">
                <AvatarImage
                  src={`https://api.dicebear.com/7.x/initials/svg?seed=${avatarSeed}`}
                  alt={buyerName}
                />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="grid gap-1">
                <p className="text-sm font-medium leading-none">{buyerName}</p>
                <p className="text-sm text-muted-foreground">{buyerEmail}</p>
              </div>
              <div className="ml-auto font-medium">{amount}</div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function formatTrend(trend: MetricTrend) {
  const prefix = trend.percent > 0 ? "+" : trend.percent < 0 ? "" : "";
  const percent = PERCENT_FORMATTER.format(trend.percent);
  return `${prefix}${percent}% ${trend.label}`;
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0]?.[0]?.toUpperCase() ?? "B";
  }
  return (
    (parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")
  ).toUpperCase();
}
