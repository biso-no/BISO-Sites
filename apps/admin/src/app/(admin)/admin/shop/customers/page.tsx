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
import { getTranslations } from "next-intl/server";
import { getOrders } from "@/app/actions/orders";

export default async function CustomersPage() {
  const orders = await getOrders({ limit: 500 });
  const t = await getTranslations("adminShop");

  const customersMap = new Map<
    string,
    { name: string; email: string; orders: number; total: number }
  >();
  for (const o of orders as any[]) {
    const email = (o.buyer_email || "").toLowerCase().trim();
    const name = o.buyer_name || "Guest";
    const key = email || `guest-${name}`;
    const prev = customersMap.get(key) || { name, email, orders: 0, total: 0 };
    customersMap.set(key, {
      name,
      email,
      orders: prev.orders + 1,
      total: prev.total + (o.total || 0),
    });
  }

  const customers = Array.from(customersMap.values()).sort(
    (a, b) => b.total - a.total
  );

  return (
    <div className="flex w-full flex-col">
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle>{t("customers.title")}</CardTitle>
          <CardDescription>{t("customers.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("customers.table.name")}</TableHead>
                <TableHead>{t("customers.table.email")}</TableHead>
                <TableHead className="text-right">
                  {t("customers.table.orders")}
                </TableHead>
                <TableHead className="text-right">
                  {t("customers.table.totalSpent")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((c) => (
                <TableRow
                  key={(c.email || c.name) + c.orders}
                  className="hover:bg-muted/50"
                >
                  <TableCell>{c.name}</TableCell>
                  <TableCell>{c.email || "-"}</TableCell>
                  <TableCell className="text-right">{c.orders}</TableCell>
                  <TableCell className="text-right">
                    {c.total.toFixed(2)} NOK
                  </TableCell>
                </TableRow>
              ))}
              {customers.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center text-sm text-muted-foreground"
                  >
                    {t("customers.empty")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
