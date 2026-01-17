"use client";

import type {
  MembershipProductSyncItem,
  MembershipProductSyncResult,
} from "@repo/connectors/24sevenoffice";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@repo/ui/components/ui/alert-dialog";
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
import {
  AlertCircle,
  CheckCircle,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { useState, useTransition } from "react";
import { executeSync, previewSync } from "@/app/actions/membership-sync";

type MembershipSyncClientProps = {
  initialItems: MembershipProductSyncItem[];
};

const DATE_FORMATTER = new Intl.DateTimeFormat("nb-NO", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function MembershipSyncClient({
  initialItems,
}: MembershipSyncClientProps) {
  const [items, setItems] = useState<MembershipProductSyncItem[]>(initialItems);
  const [syncResult, setSyncResult] =
    useState<MembershipProductSyncResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const freshItems = await previewSync();
      setItems(freshItems);
      setSyncResult(null);
    } catch (error) {
      console.error("Failed to refresh:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSync = () => {
    startTransition(async () => {
      try {
        const result = await executeSync();
        setSyncResult(result);
        // Refresh the list after sync
        const freshItems = await previewSync();
        setItems(freshItems);
      } catch (error) {
        console.error("Sync failed:", error);
        setSyncResult({
          success: false,
          created: 0,
          updated: 0,
          skipped: 0,
          errors: [String(error)],
          items: [],
        });
      }
    });
  };

  const activeCount = items.filter((i) => i.isActive).length;
  const expiredCount = items.filter((i) => !i.isActive).length;
  const unmatchedCount = items.filter((i) => !i.categoryId).length;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="glass-panel">
          <CardHeader className="pb-2">
            <CardTitle className="font-medium text-sm">
              Total Products
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{items.length}</div>
          </CardContent>
        </Card>
        <Card className="glass-panel">
          <CardHeader className="pb-2">
            <CardTitle className="font-medium text-emerald-600 text-sm dark:text-emerald-400">
              Active
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl text-emerald-600 dark:text-emerald-400">
              {activeCount}
            </div>
          </CardContent>
        </Card>
        <Card className="glass-panel">
          <CardHeader className="pb-2">
            <CardTitle className="font-medium text-rose-600 text-sm dark:text-rose-400">
              Expired
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl text-rose-600 dark:text-rose-400">
              {expiredCount}
            </div>
          </CardContent>
        </Card>
        <Card className="glass-panel">
          <CardHeader className="pb-2">
            <CardTitle className="font-medium text-amber-600 text-sm dark:text-amber-400">
              No Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl text-amber-600 dark:text-amber-400">
              {unmatchedCount}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sync Result Alert */}
      {syncResult && (
        <Card
          className={cn(
            "border-2",
            syncResult.success
              ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20"
              : "border-rose-500 bg-rose-50 dark:bg-rose-950/20"
          )}
        >
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              {syncResult.success ? (
                <CheckCircle className="h-5 w-5 text-emerald-600" />
              ) : (
                <XCircle className="h-5 w-5 text-rose-600" />
              )}
              Sync {syncResult.success ? "Complete" : "Failed"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-6 text-sm">
              <span>
                <strong>{syncResult.created}</strong> created
              </span>
              <span>
                <strong>{syncResult.updated}</strong> updated
              </span>
              <span>
                <strong>{syncResult.skipped}</strong> skipped
              </span>
            </div>
            {syncResult.errors.length > 0 && (
              <div className="mt-2 text-rose-600 text-sm">
                {syncResult.errors.map((e, i) => (
                  <p key={i}>{e}</p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          disabled={isRefreshing || isPending}
          onClick={handleRefresh}
          variant="outline"
        >
          {isRefreshing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Refresh Preview
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button disabled={isPending || items.length === 0}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sync to Database
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Sync Memberships</AlertDialogTitle>
              <AlertDialogDescription>
                This will sync {items.length} membership products from
                24SevenOffice to the Appwrite database. Existing records will be
                updated.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleSync}>
                Continue
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Products Table */}
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle>Membership Products</CardTitle>
          <CardDescription>
            Products from 24SevenOffice that will be synced to the memberships
            table.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Product Name</TableHead>
                <TableHead>Category ID</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>Expiry Date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.productId}>
                  <TableCell className="font-mono text-sm">
                    {item.productId}
                  </TableCell>
                  <TableCell className="font-medium">
                    {item.productName}
                  </TableCell>
                  <TableCell>
                    {item.categoryId ? (
                      <span className="font-mono text-sm">
                        {item.categoryId}
                      </span>
                    ) : (
                      <Badge
                        className="border-amber-300 text-amber-600"
                        variant="outline"
                      >
                        <AlertCircle className="mr-1 h-3 w-3" />
                        No match
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {DATE_FORMATTER.format(new Date(item.startDate))}
                  </TableCell>
                  <TableCell className="text-sm">
                    {DATE_FORMATTER.format(new Date(item.expiryDate))}
                  </TableCell>
                  <TableCell>
                    {item.isActive ? (
                      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">
                        Active
                      </Badge>
                    ) : (
                      <Badge className="bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-100">
                        Expired
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {items.length === 0 && (
                <TableRow>
                  <TableCell
                    className="py-8 text-center text-muted-foreground"
                    colSpan={6}
                  >
                    No membership products found in 24SevenOffice.
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
