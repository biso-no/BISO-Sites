'use client'

import { useMemo } from "react"
import Image from "next/image"
import Link from "next/link"
import { MoreHorizontal, Plus, TrendingUp } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { TabsContent } from "@/components/ui/tabs"

import { updateProduct, deleteProduct } from "@/app/actions/products"
import { ProductWithTranslations } from "@/lib/types/product"
import {
  formatPercentage,
  getLocaleLabel,
  getStatusToken,
  getUniqueLocales,
  parseJSONSafe,
} from "@/lib/utils/admin"
import { AdminSummary } from "@/components/admin/admin-summary"

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

export function ProductsTable({ products }: { products: ProductWithTranslations[] }) {
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

    return {
      total,
      published,
      draft,
      archived,
      translationCoverage: formatPercentage(translationComplete, total),
    }
  }, [products])

  const formatPrice = (metadata: Record<string, any>) => {
    if (typeof metadata.price === "number") return NOK_FORMATTER.format(metadata.price)
    const parsed = Number(metadata.price)
    if (!Number.isFinite(parsed)) return "—"
    return NOK_FORMATTER.format(parsed)
  }

  const handleUpdateStatus = async (productId: string, newStatus: "draft" | "published" | "archived") => {
    await updateProduct(productId, { status: newStatus })
  }

  const handleDeleteProduct = async (productId: string) => {
    await deleteProduct(productId)
  }

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
                  <TableHead className="hidden w-[100px] sm:table-cell">
                    <span className="sr-only">Image</span>
                  </TableHead>
                  <TableHead className="min-w-[160px]">Produkt</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Oversettelser</TableHead>
                  <TableHead className="hidden md:table-cell">Pris</TableHead>
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
                  const metadata = parseJSONSafe<Record<string, unknown>>(product.metadata)
                  const title = refs[0]?.title || product.slug
                  const statusToken = getStatusToken(product.status)
                  const uniqueLocales = getUniqueLocales(refs)
                  const primaryImage = product.image || (metadata as any).image || "/placeholder.svg"

                  return (
                    <TableRow key={product.$id} className="group transition hover:bg-primary/5">
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
                        {formatPrice(metadata)}
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
