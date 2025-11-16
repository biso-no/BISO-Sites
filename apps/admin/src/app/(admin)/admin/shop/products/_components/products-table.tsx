'use client'

import { useMemo, useEffect, useState, useTransition } from "react"
import type { FormEvent } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { MoreHorizontal, Plus, TrendingUp } from "lucide-react"

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
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu"
import { Checkbox } from "@repo/ui/components/ui/checkbox"
import { Input } from "@repo/ui/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/ui/table"
import { TabsContent } from "@repo/ui/components/ui/tabs"

import { updateProduct, deleteProduct, bulkUpdateProductStatus, bulkUpdateProductPrices, bulkUpdateProductStock } from "@/app/actions/products"
import { ProductWithTranslations } from "@/lib/types/product"
import {
  formatPercentage,
  getLocaleLabel,
  getStatusToken,
  getUniqueLocales,
  parseJSONSafe,
} from "@/lib/utils/admin"
import { AdminSummary } from "@/components/admin/admin-summary"
import { cn } from "@repo/ui/lib/utils"

const NOK_FORMATTER = new Intl.NumberFormat("nb-NO", {
  style: "currency",
  currency: "NOK",
  maximumFractionDigits: 0,
})

const DATE_FORMATTER = new Intl.DateTimeFormat("nb-NO", {
  year: "numeric",
  month: "short",
  day: "numeric",
})

const LOW_STOCK_THRESHOLD = 10

export function ProductsTable({ products }: { products: ProductWithTranslations[] }) {
  const router = useRouter()
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [priceValue, setPriceValue] = useState("5")
  const [priceMode, setPriceMode] = useState<"percent" | "absolute">("percent")
  const [stockValue, setStockValue] = useState("5")
  const [stockMode, setStockMode] = useState<"adjust" | "set">("adjust")
  const [bulkFeedback, setBulkFeedback] = useState<string | null>(null)
  const [isBulkPending, startBulkTransition] = useTransition()

  const aggregates = useMemo(() => {
    const total = products.length
    const published = products.filter((product) => product.status === "published").length
    const draft = products.filter((product) => product.status === "draft").length
    const archived = products.filter((product) => product.status === "archived").length
    const translationComplete = products.filter((product) => {
      const refs = product.translation_refs ?? []
      const locales = refs.map((ref) => ref.locale)
      return locales.includes("no") && locales.includes("en")
    }).length

    const lowStock = products.filter(
      (product) => typeof product.stock === "number" && product.stock >= 0 && product.stock <= LOW_STOCK_THRESHOLD,
    ).length

    return {
      total,
      published,
      draft,
      archived,
      translationCoverage: formatPercentage(translationComplete, total),
      lowStock,
    }
  }, [products])

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => products.some((product) => product.$id === id)))
  }, [products])

  const formatPrice = (price: number | null | undefined) => {
    if (typeof price === "number") return NOK_FORMATTER.format(price)
    const parsed = Number(price)
    if (!Number.isFinite(parsed)) return "—"
    return NOK_FORMATTER.format(parsed)
  }

  const handleUpdateStatus = async (productId: string, newStatus: "draft" | "published" | "archived") => {
    await updateProduct(productId, { status: newStatus })
  }

  const handleDeleteProduct = async (productId: string) => {
    await deleteProduct(productId)
  }

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(products.map((product) => product.$id))
    } else {
      setSelectedIds([])
    }
  }

  const toggleSelect = (productId: string, checked: boolean) => {
    setSelectedIds((prev) =>
      checked ? Array.from(new Set([...prev, productId])) : prev.filter((id) => id !== productId),
    )
  }

  const runBulkStatusUpdate = (status: "draft" | "published" | "archived") => {
    startBulkTransition(async () => {
      const result = await bulkUpdateProductStatus(selectedIds, status)
      if (!result?.success) {
        setBulkFeedback(result?.error || "Kunne ikke oppdatere status.")
        return
      }
      setBulkFeedback("Status oppdatert")
      setSelectedIds([])
      router.refresh()
    })
  }

  const handlePriceSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const value = Number(priceValue)
    if (!Number.isFinite(value)) {
      setBulkFeedback("Oppgi en gyldig prisverdi.")
      return
    }
    startBulkTransition(async () => {
      const result = await bulkUpdateProductPrices(selectedIds, { mode: priceMode, value })
      if (!result?.success) {
        setBulkFeedback(result?.error || "Kunne ikke oppdatere pris.")
        return
      }
      setBulkFeedback("Pris oppdatert")
      setSelectedIds([])
      router.refresh()
    })
  }

  const handleStockSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const value = Number(stockValue)
    if (!Number.isFinite(value)) {
      setBulkFeedback("Oppgi en gyldig lagerverdi.")
      return
    }
    startBulkTransition(async () => {
      const result = await bulkUpdateProductStock(selectedIds, { mode: stockMode, value })
      if (!result?.success) {
        setBulkFeedback(result?.error || "Kunne ikke oppdatere lager.")
        return
      }
      setBulkFeedback("Lager oppdatert")
      setSelectedIds([])
      router.refresh()
    })
  }

  const renderStockValue = (stock: number | null | undefined) => {
    if (typeof stock === "number") {
      if (stock <= 0) {
        return <Badge variant="destructive">Tomt</Badge>
      }
      if (stock <= LOW_STOCK_THRESHOLD) {
        return <Badge variant="outline" className="border-amber-200 text-amber-600">Lavt ({stock})</Badge>
      }
      return stock
    }
    return "—"
  }

  const allSelected = selectedIds.length > 0 && selectedIds.length === products.length
  const partiallySelected = selectedIds.length > 0 && selectedIds.length < products.length

  return (
    <TabsContent value="all">
      <AdminSummary
        className="mb-6"
        badge="Produktkatalog"
        title="Shop inventory"
        description="Følg lanseringer, tilgjengelighet og språkdekning på merch og produkter."
        metrics={[
          { label: "Totalt", value: aggregates.total },
          { label: "Publiserte", value: aggregates.published },
          { label: "Utkast", value: aggregates.draft },
          { label: "Oversettelser", value: aggregates.translationCoverage },
          { label: "Lavt lager", value: aggregates.lowStock },
        ]}
        action={
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" className="rounded-full bg-primary-40 px-4 font-semibold text-white shadow-[0_15px_35px_-22px_rgba(0,23,49,0.7)] hover:bg-primary-30">
              <Link href="/admin/shop/products/new" className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Nytt produkt
              </Link>
            </Button>
            <Button variant="outline" size="sm" className="rounded-full border-primary/20 bg-white/80 text-primary-90 hover:bg-primary/5">
              <TrendingUp className="mr-2 h-4 w-4" />
              Rapporter
            </Button>
          </div>
        }
      />

      {selectedIds.length > 0 && (
        <div className="mb-4 rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3 shadow-inner">
          <div className="flex flex-wrap items-center gap-3 text-sm font-medium text-primary-90">
            <span>{selectedIds.length} valgt</span>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelectedIds([])}>
              Nullstill
            </Button>
            {bulkFeedback && <span className="text-xs text-primary-60">{bulkFeedback}</span>}
          </div>
          <div className="mt-3 grid gap-4 lg:grid-cols-3">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary-70">Status</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isBulkPending}
                  onClick={() => runBulkStatusUpdate("published")}
                >
                  Publiser
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isBulkPending}
                  onClick={() => runBulkStatusUpdate("draft")}
                >
                  Utkast
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isBulkPending}
                  onClick={() => runBulkStatusUpdate("archived")}
                >
                  Arkiver
                </Button>
              </div>
            </div>
            <form className="space-y-2" onSubmit={handlePriceSubmit}>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary-70">Pris</p>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  step="0.5"
                  value={priceValue}
                  onChange={(event) => setPriceValue(event.target.value)}
                  className="h-9"
                  placeholder="Verdi"
                />
                <Select value={priceMode} onValueChange={(value) => setPriceMode(value as "percent" | "absolute")}>
                  <SelectTrigger className="h-9 w-[140px]">
                    <SelectValue placeholder="Velg modus" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">% juster</SelectItem>
                    <SelectItem value="absolute">Sett pris</SelectItem>
                  </SelectContent>
                </Select>
                <Button type="submit" size="sm" disabled={isBulkPending}>
                  Oppdater
                </Button>
              </div>
            </form>
            <form className="space-y-2" onSubmit={handleStockSubmit}>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary-70">Lager</p>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  step="1"
                  value={stockValue}
                  onChange={(event) => setStockValue(event.target.value)}
                  className="h-9"
                  placeholder="Antall"
                />
                <Select value={stockMode} onValueChange={(value) => setStockMode(value as "adjust" | "set")}>
                  <SelectTrigger className="h-9 w-[140px]">
                    <SelectValue placeholder="Velg modus" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="adjust">Juster ±</SelectItem>
                    <SelectItem value="set">Sett lager</SelectItem>
                  </SelectContent>
                </Select>
                <Button type="submit" size="sm" disabled={isBulkPending}>
                  Oppdater
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Card className="glass-panel border border-primary/10 shadow-[0_30px_55px_-40px_rgba(0,23,49,0.4)]">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg font-semibold text-primary-100">Produkter</CardTitle>
            <CardDescription className="text-sm text-primary-60">
              Administrer produkter, status og lokalisering direkte i katalogen.
            </CardDescription>
          </div>
          <Badge variant="outline" className="rounded-full border-primary/15 bg-primary/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary-80">
            {aggregates.translationCoverage} dekket
          </Badge>
        </CardHeader>
        <CardContent className="p-0">
          <div className="relative overflow-x-auto">
            <Table className="text-sm">
              <TableHeader>
                <TableRow className="bg-primary/5">
                  <TableHead className="w-10">
                    <Checkbox
                      aria-label="Velg alle produkter"
                      checked={allSelected ? true : partiallySelected ? "indeterminate" : false}
                      onCheckedChange={(checked) => toggleSelectAll(Boolean(checked))}
                    />
                  </TableHead>
                  <TableHead className="hidden w-[100px] sm:table-cell">
                    <span className="sr-only">Image</span>
                  </TableHead>
                  <TableHead className="min-w-[160px]">Produkt</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Oversettelser</TableHead>
                  <TableHead className="hidden md:table-cell">Pris</TableHead>
                  <TableHead className="hidden md:table-cell">Lager</TableHead>
                  <TableHead className="hidden md:table-cell">Campus</TableHead>
                  <TableHead className="hidden md:table-cell">Opprettet</TableHead>
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-primary/10 bg-white/70">
                {products.map((product) => {
                const refs = product.translation_refs ?? []
                const metadata = (product.metadata_parsed as Record<string, unknown> | undefined) ?? parseJSONSafe<Record<string, unknown>>(product.metadata)
                  const title = refs[0]?.title || product.slug
                  const statusToken = getStatusToken(product.status)
                  const uniqueLocales = getUniqueLocales(refs)
                  const primaryImage = product.image || (metadata as any).image || "/placeholder.svg"

                  const isSelected = selectedIds.includes(product.$id)

                  return (
                    <TableRow
                      key={product.$id}
                      className={cn(
                        "group transition hover:bg-primary/5",
                        isSelected && "bg-primary/5/60",
                      )}
                    >
                      <TableCell>
                        <Checkbox
                          aria-label={`Velg ${title}`}
                          checked={isSelected}
                          onCheckedChange={(checked) => toggleSelect(product.$id, Boolean(checked))}
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
                        <Link href={`/admin/shop/products/${product.$id}`} className="hover:underline">
                          {title}
                        </Link>
                        <div className="text-xs text-primary-50">{product.slug}</div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`rounded-full px-3 py-0.5 text-xs font-semibold uppercase tracking-wide ${statusToken.className}`}>
                          {statusToken.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1.5">
                          {uniqueLocales.length > 0 ? (
                            uniqueLocales.map((locale) => (
                              <span
                                key={`${product.$id}-${locale}`}
                                className="inline-flex items-center rounded-full border border-primary/10 bg-primary/5 px-2 py-0.5 text-[11px] font-semibold text-primary-80"
                              >
                                {getLocaleLabel(locale)}
                              </span>
                            ))
                          ) : (
                            <span className="inline-flex items-center rounded-full border border-destructive/20 bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">
                              Mangler oversettelser
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
                            <Button aria-haspopup="true" size="icon" variant="ghost" className="h-8 w-8 rounded-full hover:bg-primary/10">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Toggle menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleUpdateStatus(product.$id, "published")}>
                              Set Published
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleUpdateStatus(product.$id, "draft")}>
                              Set Draft
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleUpdateStatus(product.$id, "archived")}>
                              Archive
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleDeleteProduct(product.$id)}>
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col items-start justify-between gap-3 border-t border-primary/10 bg-white/70 px-6 py-4 text-xs text-primary-60 sm:flex-row sm:items-center sm:text-sm">
          <span>
            Viser <strong>1-{products.length}</strong> av <strong>{products.length}</strong> produkter
          </span>
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/10 bg-primary/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-primary-70">
            Oppdatert {DATE_FORMATTER.format(new Date())}
          </div>
        </CardFooter>
      </Card>
    </TabsContent>
  )
}
