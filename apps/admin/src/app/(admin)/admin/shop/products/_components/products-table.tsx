"use client";

import { Locale } from "@repo/api/types/appwrite";
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
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { Input } from "@repo/ui/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/ui/table";
import { TabsContent } from "@repo/ui/components/ui/tabs";
import { cn } from "@repo/ui/lib/utils";
import { MoreHorizontal, Plus, TrendingUp } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  bulkUpdateProductPrices,
  bulkUpdateProductStatus,
  bulkUpdateProductStock,
  deleteProduct,
  updateProduct,
} from "@/app/actions/products";
import { AdminSummary } from "@/components/admin/admin-summary";
import type { ProductWithTranslations } from "@/lib/types/product";
import {
  formatPercentage,
  getLocaleLabel,
  getStatusToken,
  getUniqueLocales,
  parseJSONSafe,
} from "@/lib/utils/admin";

const NOK_FORMATTER = new Intl.NumberFormat("nb-NO", {
  style: "currency",
  currency: "NOK",
  maximumFractionDigits: 0,
});

const DATE_FORMATTER = new Intl.DateTimeFormat("nb-NO", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

const LOW_STOCK_THRESHOLD = 10;

export function ProductsTable({
  products,
}: {
  products: ProductWithTranslations[];
}) {
  const t = useTranslations("adminShop");
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [priceValue, setPriceValue] = useState("5");
  const [priceMode, setPriceMode] = useState<"percent" | "absolute">("percent");
  const [stockValue, setStockValue] = useState("5");
  const [stockMode, setStockMode] = useState<"adjust" | "set">("adjust");
  const [bulkFeedback, setBulkFeedback] = useState<string | null>(null);
  const [isBulkPending, startBulkTransition] = useTransition();

  const aggregates = useMemo(() => {
    const total = products.length;
    const published = products.filter(
      (product) => product.status === "published"
    ).length;
    const draft = products.filter(
      (product) => product.status === "draft"
    ).length;
    const archived = products.filter(
      (product) => product.status === "archived"
    ).length;
    const translationComplete = products.filter((product) => {
      const refs = product.translation_refs ?? [];
      const locales = refs.map((ref) => ref.locale);
      return locales.includes(Locale.NO) && locales.includes(Locale.EN);
    }).length;

    const lowStock = products.filter(
      (product) =>
        typeof product.stock === "number" &&
        product.stock >= 0 &&
        product.stock <= LOW_STOCK_THRESHOLD
    ).length;

    return {
      total,
      published,
      draft,
      archived,
      translationCoverage: formatPercentage(translationComplete, total),
      lowStock,
    };
  }, [products]);

  useEffect(() => {
    setSelectedIds((prev) =>
      prev.filter((id) => products.some((product) => product.$id === id))
    );
  }, [products]);

  const formatPrice = (price: number | null | undefined) => {
    if (typeof price === "number") {
      return NOK_FORMATTER.format(price);
    }
    const parsed = Number(price);
    if (!Number.isFinite(parsed)) {
      return "—";
    }
    return NOK_FORMATTER.format(parsed);
  };

  const handleUpdateStatus = async (
    productId: string,
    newStatus: "draft" | "published" | "archived"
  ) => {
    await updateProduct(productId, { status: newStatus });
  };

  const handleDeleteProduct = async (productId: string) => {
    await deleteProduct(productId);
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(products.map((product) => product.$id));
    } else {
      setSelectedIds([]);
    }
  };

  const toggleSelect = (productId: string, checked: boolean) => {
    setSelectedIds((prev) =>
      checked
        ? Array.from(new Set([...prev, productId]))
        : prev.filter((id) => id !== productId)
    );
  };

  const runBulkStatusUpdate = (status: "draft" | "published" | "archived") => {
    startBulkTransition(async () => {
      const result = await bulkUpdateProductStatus(selectedIds, status);
      if (!result?.success) {
        setBulkFeedback(result?.error || t("messages.updateStatusError"));
        return;
      }
      setBulkFeedback(t("messages.statusUpdated"));
      setSelectedIds([]);
      router.refresh();
    });
  };

  const handlePriceSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = Number(priceValue);
    if (!Number.isFinite(value)) {
      setBulkFeedback(t("messages.invalidPriceValue"));
      return;
    }
    startBulkTransition(async () => {
      const result = await bulkUpdateProductPrices(selectedIds, {
        mode: priceMode,
        value,
      });
      if (!result?.success) {
        setBulkFeedback(result?.error || t("messages.updatePriceError"));
        return;
      }
      setBulkFeedback(t("messages.priceUpdated"));
      setSelectedIds([]);
      router.refresh();
    });
  };

  const handleStockSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = Number(stockValue);
    if (!Number.isFinite(value)) {
      setBulkFeedback(t("messages.invalidStockValue"));
      return;
    }
    startBulkTransition(async () => {
      const result = await bulkUpdateProductStock(selectedIds, {
        mode: stockMode,
        value,
      });
      if (!result?.success) {
        setBulkFeedback(result?.error || t("messages.updateStockError"));
        return;
      }
      setBulkFeedback(t("messages.stockUpdated"));
      setSelectedIds([]);
      router.refresh();
    });
  };

  const renderStockValue = (stock: number | null | undefined) => {
    if (typeof stock === "number") {
      if (stock <= 0) {
        return (
          <Badge variant="destructive">{t("products.stockStatus.empty")}</Badge>
        );
      }
      if (stock <= LOW_STOCK_THRESHOLD) {
        return (
          <Badge className="border-amber-200 text-amber-600" variant="outline">
            {t("products.stockStatus.low", { count: stock })}
          </Badge>
        );
      }
      return stock;
    }
    return "—";
  };

  const allSelected =
    selectedIds.length > 0 && selectedIds.length === products.length;
  const partiallySelected =
    selectedIds.length > 0 && selectedIds.length < products.length;

  return (
    <TabsContent value="all">
      <AdminSummary
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              asChild
              className="rounded-full bg-primary-40 px-4 font-semibold text-white shadow-[0_15px_35px_-22px_rgba(0,23,49,0.7)] hover:bg-primary-30"
              size="sm"
            >
              <Link
                className="flex items-center gap-2"
                href="/admin/shop/products/new"
              >
                <Plus className="h-4 w-4" />
                {t("products.newProduct")}
              </Link>
            </Button>
            <Button
              className="rounded-full border-primary/20 text-primary-90 hover:bg-primary/5"
              size="sm"
              variant="outline"
            >
              <TrendingUp className="mr-2 h-4 w-4" />
              {t("products.reports")}
            </Button>
          </div>
        }
        badge={t("products.badge")}
        className="mb-6"
        description={t("products.inventoryDescription")}
        metrics={[
          { label: t("products.metrics.total"), value: aggregates.total },
          {
            label: t("products.metrics.published"),
            value: aggregates.published,
          },
          { label: t("products.metrics.draft"), value: aggregates.draft },
          {
            label: t("products.metrics.translations"),
            value: aggregates.translationCoverage,
          },
          { label: t("products.metrics.lowStock"), value: aggregates.lowStock },
        ]}
        title={t("products.inventoryTitle")}
      />

      {selectedIds.length > 0 && (
        <div className="mb-4 rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3 shadow-inner">
          <div className="flex flex-wrap items-center gap-3 font-medium text-primary-90 text-sm">
            <span>
              {t("products.bulkActions.selected", {
                count: selectedIds.length,
              })}
            </span>
            <Button
              className="h-7 text-xs"
              onClick={() => setSelectedIds([])}
              size="sm"
              variant="ghost"
            >
              {t("products.bulkActions.reset")}
            </Button>
            {bulkFeedback && (
              <span className="text-primary-60 text-xs">{bulkFeedback}</span>
            )}
          </div>
          <div className="mt-3 grid gap-4 lg:grid-cols-3">
            <div className="space-y-2">
              <p className="font-semibold text-primary-70 text-xs uppercase tracking-wide">
                {t("products.bulkActions.status")}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={isBulkPending}
                  onClick={() => runBulkStatusUpdate("published")}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {t("products.bulkActions.publish")}
                </Button>
                <Button
                  disabled={isBulkPending}
                  onClick={() => runBulkStatusUpdate("draft")}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {t("products.bulkActions.draft")}
                </Button>
                <Button
                  disabled={isBulkPending}
                  onClick={() => runBulkStatusUpdate("archived")}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {t("products.bulkActions.archive")}
                </Button>
              </div>
            </div>
            <form className="space-y-2" onSubmit={handlePriceSubmit}>
              <p className="font-semibold text-primary-70 text-xs uppercase tracking-wide">
                {t("products.bulkActions.price")}
              </p>
              <div className="flex items-center gap-2">
                <Input
                  className="h-9"
                  onChange={(event) => setPriceValue(event.target.value)}
                  placeholder={t("products.bulkActions.priceValue")}
                  step="0.5"
                  type="number"
                  value={priceValue}
                />
                <Select
                  onValueChange={(value) =>
                    setPriceMode(value as "percent" | "absolute")
                  }
                  value={priceMode}
                >
                  <SelectTrigger className="h-9 w-[140px]">
                    <SelectValue
                      placeholder={t("products.bulkActions.selectMode")}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">
                      {t("products.bulkActions.percentAdjust")}
                    </SelectItem>
                    <SelectItem value="absolute">
                      {t("products.bulkActions.setPrice")}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Button disabled={isBulkPending} size="sm" type="submit">
                  {t("products.bulkActions.update")}
                </Button>
              </div>
            </form>
            <form className="space-y-2" onSubmit={handleStockSubmit}>
              <p className="font-semibold text-primary-70 text-xs uppercase tracking-wide">
                {t("products.bulkActions.stock")}
              </p>
              <div className="flex items-center gap-2">
                <Input
                  className="h-9"
                  onChange={(event) => setStockValue(event.target.value)}
                  placeholder={t("products.bulkActions.stockValue")}
                  step="1"
                  type="number"
                  value={stockValue}
                />
                <Select
                  onValueChange={(value) =>
                    setStockMode(value as "adjust" | "set")
                  }
                  value={stockMode}
                >
                  <SelectTrigger className="h-9 w-[140px]">
                    <SelectValue
                      placeholder={t("products.bulkActions.selectMode")}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="adjust">
                      {t("products.bulkActions.adjust")}
                    </SelectItem>
                    <SelectItem value="set">
                      {t("products.bulkActions.setStock")}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Button disabled={isBulkPending} size="sm" type="submit">
                  {t("products.bulkActions.update")}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Card className="glass-panel border border-primary/10 shadow-[0_30px_55px_-40px_rgba(0,23,49,0.4)]">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="font-semibold text-lg text-primary-100">
              {t("products.title")}
            </CardTitle>
            <CardDescription className="text-primary-60 text-sm">
              {t("products.manageDescription")}
            </CardDescription>
          </div>
          <Badge
            className="rounded-full border-primary/15 bg-primary/5 px-3 py-1 font-semibold text-primary-80 text-xs uppercase tracking-[0.16em]"
            variant="outline"
          >
            {aggregates.translationCoverage} {t("products.table.covered")}
          </Badge>
        </CardHeader>
        <CardContent className="p-0">
          <div className="relative overflow-x-auto">
            <Table className="text-sm">
              <TableHeader>
                <TableRow className="bg-primary/5">
                  <TableHead className="w-10">
                    <Checkbox
                      aria-label={t("products.table.selectAll")}
                      checked={
                        allSelected
                          ? true
                          : partiallySelected
                            ? "indeterminate"
                            : false
                      }
                      onCheckedChange={(checked) =>
                        toggleSelectAll(Boolean(checked))
                      }
                    />
                  </TableHead>
                  <TableHead className="hidden w-[100px] sm:table-cell">
                    <span className="sr-only">{t("products.table.image")}</span>
                  </TableHead>
                  <TableHead className="min-w-[160px]">
                    {t("products.table.product")}
                  </TableHead>
                  <TableHead>{t("products.table.status")}</TableHead>
                  <TableHead>{t("products.table.translations")}</TableHead>
                  <TableHead className="hidden md:table-cell">
                    {t("products.table.price")}
                  </TableHead>
                  <TableHead className="hidden md:table-cell">
                    {t("products.table.stock")}
                  </TableHead>
                  <TableHead className="hidden md:table-cell">
                    {t("products.table.campus")}
                  </TableHead>
                  <TableHead className="hidden md:table-cell">
                    {t("products.table.created")}
                  </TableHead>
                  <TableHead>
                    <span className="sr-only">
                      {t("products.table.actions")}
                    </span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-primary/10 bg-white/70">
                {products.map((product) => {
                  const refs = product.translation_refs ?? [];
                  const metadata =
                    (product.metadata_parsed as
                      | Record<string, unknown>
                      | undefined) ??
                    parseJSONSafe<Record<string, unknown>>(product.metadata);
                  const title = refs[0]?.title || product.slug;
                  const statusToken = getStatusToken(product.status);
                  const uniqueLocales = getUniqueLocales(refs);
                  const primaryImage =
                    product.image ||
                    (metadata as any).image ||
                    "/placeholder.svg";

                  const isSelected = selectedIds.includes(product.$id);

                  return (
                    <TableRow
                      className={cn(
                        "group transition hover:bg-primary/5",
                        isSelected && "bg-primary/5/60"
                      )}
                      key={product.$id}
                    >
                      <TableCell>
                        <Checkbox
                          aria-label={t("products.table.selectProduct", {
                            title,
                          })}
                          checked={isSelected}
                          onCheckedChange={(checked) =>
                            toggleSelect(product.$id, Boolean(checked))
                          }
                        />
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <div className="overflow-hidden rounded-xl border border-primary/10 bg-primary/5">
                          <Image
                            alt={`${title} image`}
                            className="aspect-square h-16 w-16 object-cover transition group-hover:scale-105"
                            height={64}
                            src={primaryImage}
                            width={64}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="font-medium text-primary-100">
                        <Link
                          className="hover:underline"
                          href={`/admin/shop/products/${product.$id}`}
                        >
                          {title}
                        </Link>
                        <div className="text-primary-50 text-xs">
                          {product.slug}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={`rounded-full px-3 py-0.5 font-semibold text-xs uppercase tracking-wide ${statusToken.className}`}
                        >
                          {statusToken.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1.5">
                          {uniqueLocales.length > 0 ? (
                            uniqueLocales.map((locale) => (
                              <span
                                className="inline-flex items-center rounded-full border border-primary/10 bg-primary/5 px-2 py-0.5 font-semibold text-[11px] text-primary-80"
                                key={`${product.$id}-${locale}`}
                              >
                                {getLocaleLabel(locale)}
                              </span>
                            ))
                          ) : (
                            <span className="inline-flex items-center rounded-full border border-destructive/20 bg-destructive/10 px-2 py-0.5 font-semibold text-[11px] text-destructive">
                              {t("products.table.missingTranslations")}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {formatPrice(product.regular_price)}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {renderStockValue(product.stock)}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {product.campus?.name || product.campus_id || "—"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {DATE_FORMATTER.format(new Date(product.$createdAt))}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              aria-haspopup="true"
                              className="h-8 w-8 rounded-full hover:bg-primary/10"
                              size="icon"
                              variant="ghost"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Toggle menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>
                              {t("products.table.actions")}
                            </DropdownMenuLabel>
                            <DropdownMenuItem
                              onClick={() =>
                                handleUpdateStatus(product.$id, "published")
                              }
                            >
                              {t("products.actions.setPublished")}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                handleUpdateStatus(product.$id, "draft")
                              }
                            >
                              {t("products.actions.setDraft")}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                handleUpdateStatus(product.$id, "archived")
                              }
                            >
                              {t("products.actions.archive")}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDeleteProduct(product.$id)}
                            >
                              {t("products.actions.delete")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col items-start justify-between gap-3 border-primary/10 border-t px-6 py-4 text-primary-60 text-xs sm:flex-row sm:items-center sm:text-sm">
          <span
            dangerouslySetInnerHTML={{
              __html: t("products.table.showing", {
                start: 1,
                end: products.length,
                total: products.length,
              }),
            }}
          />
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/10 bg-primary/5 px-3 py-1 font-semibold text-primary-70 text-xs uppercase tracking-[0.14em]">
            {t("products.table.updated", {
              date: DATE_FORMATTER.format(new Date()),
            })}
          </div>
        </CardFooter>
      </Card>
    </TabsContent>
  );
}
