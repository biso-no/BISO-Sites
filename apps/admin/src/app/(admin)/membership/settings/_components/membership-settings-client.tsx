"use client";

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { Switch } from "@repo/ui/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/ui/table";
import { cn } from "@repo/ui/lib/utils";
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  Loader2,
  Package,
  RefreshCw,
  ShoppingCart,
} from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import type { MembershipSettingsItem } from "@/app/actions/membership-settings";
import {
  updateMembershipPurchasable,
  updateMembershipStatus,
} from "@/app/actions/membership-settings";

type MembershipSettingsClientProps = {
  initialItems: MembershipSettingsItem[];
  onSync: () => Promise<void>;
};

type FilterType =
  | "all"
  | "active"
  | "purchasable"
  | "expired"
  | "missing-category";

const DATE_FORMATTER = new Intl.DateTimeFormat("nb-NO", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function MembershipSettingsClient({
  initialItems,
  onSync,
}: MembershipSettingsClientProps) {
  const [items, setItems] = useState<MembershipSettingsItem[]>(initialItems);
  const [filter, setFilter] = useState<FilterType>("all");
  const [isPending, startTransition] = useTransition();
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingToggles, setPendingToggles] = useState<Set<string>>(new Set());

  // Stats
  const stats = useMemo(() => {
    const total = items.length;
    const active = items.filter((i) => i.status).length;
    const purchasable = items.filter((i) => i.canPurchase).length;
    const missingCategory = items.filter((i) => !i.category).length;
    const expired = items.filter((i) => i.isExpired).length;
    return { total, active, purchasable, missingCategory, expired };
  }, [items]);

  // Filtered items
  const filteredItems = useMemo(() => {
    switch (filter) {
      case "active":
        return items.filter((i) => i.status);
      case "purchasable":
        return items.filter((i) => i.canPurchase);
      case "expired":
        return items.filter((i) => i.isExpired);
      case "missing-category":
        return items.filter((i) => !i.category);
      default:
        return items;
    }
  }, [items, filter]);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await onSync();
      // Refresh the page to get updated data
      window.location.reload();
    } catch (error) {
      console.error("Sync failed:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleStatusToggle = (id: string, currentValue: boolean) => {
    const newValue = !currentValue;

    // Optimistic update
    setPendingToggles((prev) => new Set(prev).add(`status-${id}`));
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, status: newValue } : item
      )
    );

    startTransition(async () => {
      const result = await updateMembershipStatus(id, newValue);
      if (!result.success) {
        // Revert on error
        setItems((prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, status: currentValue } : item
          )
        );
        console.error("Failed to update status:", result.error);
      }
      setPendingToggles((prev) => {
        const next = new Set(prev);
        next.delete(`status-${id}`);
        return next;
      });
    });
  };

  const handlePurchasableToggle = (id: string, currentValue: boolean) => {
    const newValue = !currentValue;

    // Optimistic update
    setPendingToggles((prev) => new Set(prev).add(`purchase-${id}`));
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, canPurchase: newValue } : item
      )
    );

    startTransition(async () => {
      const result = await updateMembershipPurchasable(id, newValue);
      if (!result.success) {
        // Revert on error
        setItems((prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, canPurchase: currentValue } : item
          )
        );
        console.error("Failed to update purchasable:", result.error);
      }
      setPendingToggles((prev) => {
        const next = new Set(prev);
        next.delete(`purchase-${id}`);
        return next;
      });
    });
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card className="glass-panel">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 font-medium text-sm">
              <Package className="h-4 w-4" />
              Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{stats.total}</div>
          </CardContent>
        </Card>
        <Card className="glass-panel">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 font-medium text-emerald-600 text-sm dark:text-emerald-400">
              <CheckCircle className="h-4 w-4" />
              Active
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl text-emerald-600 dark:text-emerald-400">
              {stats.active}
            </div>
          </CardContent>
        </Card>
        <Card className="glass-panel">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 font-medium text-blue-600 text-sm dark:text-blue-400">
              <ShoppingCart className="h-4 w-4" />
              Purchasable
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl text-blue-600 dark:text-blue-400">
              {stats.purchasable}
            </div>
          </CardContent>
        </Card>
        <Card className="glass-panel">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 font-medium text-rose-600 text-sm dark:text-rose-400">
              <Calendar className="h-4 w-4" />
              Expired
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl text-rose-600 dark:text-rose-400">
              {stats.expired}
            </div>
          </CardContent>
        </Card>
        <Card className="glass-panel">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 font-medium text-amber-600 text-sm dark:text-amber-400">
              <AlertCircle className="h-4 w-4" />
              No Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl text-amber-600 dark:text-amber-400">
              {stats.missingCategory}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-3">
          <Button
            disabled={isSyncing || isPending}
            onClick={handleSync}
            variant="outline"
          >
            {isSyncing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Sync from 24SO
          </Button>
        </div>

        <Select
          onValueChange={(v) => setFilter(v as FilterType)}
          value={filter}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All ({stats.total})</SelectItem>
            <SelectItem value="active">Active ({stats.active})</SelectItem>
            <SelectItem value="purchasable">
              Purchasable ({stats.purchasable})
            </SelectItem>
            <SelectItem value="expired">Expired ({stats.expired})</SelectItem>
            <SelectItem value="missing-category">
              Missing Category ({stats.missingCategory})
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Memberships Table */}
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle>Membership Products</CardTitle>
          <CardDescription>
            Toggle which memberships are active (used in membership checks) and
            purchasable (available for manual member creation).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="w-28">Category</TableHead>
                <TableHead className="w-28">Start</TableHead>
                <TableHead className="w-28">Expiry</TableHead>
                <TableHead className="w-20 text-center">Active</TableHead>
                <TableHead className="w-20 text-center">Buy</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.map((item) => (
                <TableRow
                  className={cn(item.isExpired && "opacity-60")}
                  key={item.id}
                >
                  <TableCell className="font-mono text-sm">
                    {item.productId}
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {item.name}
                      {item.isExpired && (
                        <Badge
                          className="border-rose-300 text-rose-600 text-xs"
                          variant="outline"
                        >
                          Expired
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {item.category ? (
                      <span className="font-mono text-muted-foreground text-sm">
                        {item.category}
                      </span>
                    ) : (
                      <Badge
                        className="border-amber-300 text-amber-600"
                        variant="outline"
                      >
                        <AlertCircle className="mr-1 h-3 w-3" />
                        None
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {DATE_FORMATTER.format(new Date(item.startDate))}
                  </TableCell>
                  <TableCell className="text-sm">
                    {DATE_FORMATTER.format(new Date(item.expiryDate))}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center">
                      <Switch
                        checked={item.status}
                        className="data-[state=checked]:bg-emerald-600"
                        disabled={pendingToggles.has(`status-${item.id}`)}
                        onCheckedChange={() =>
                          handleStatusToggle(item.id, item.status)
                        }
                      />
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center">
                      <Switch
                        checked={item.canPurchase}
                        className="data-[state=checked]:bg-blue-600"
                        disabled={pendingToggles.has(`purchase-${item.id}`)}
                        onCheckedChange={() =>
                          handlePurchasableToggle(item.id, item.canPurchase)
                        }
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredItems.length === 0 && (
                <TableRow>
                  <TableCell
                    className="py-8 text-center text-muted-foreground"
                    colSpan={7}
                  >
                    No memberships found matching the filter.
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
