"use client"

import { useState, useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"

import { Button } from "@repo/ui/components/ui/button"
import { Input } from "@repo/ui/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select"

type ProductFiltersProps = {
  initialValues: {
    search?: string
    campus?: string
    category?: string
    stock?: string
    priceMin?: string
    priceMax?: string
  }
  options: {
    campuses: { id: string; name: string }[]
    categories: string[]
  }
}

export function ProductFilters({ initialValues, options }: ProductFiltersProps) {
  const t = useTranslations('adminShop')
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  
  const stockOptions = [
    { value: "all", label: t('products.stockStatus.allLevels') },
    { value: "in-stock", label: t('products.stockStatus.inStock') },
    { value: "low-stock", label: t('products.stockStatus.lowStock') },
    { value: "out-of-stock", label: t('products.stockStatus.outOfStock') },
  ]
  const [formValues, setFormValues] = useState({
    search: initialValues.search ?? "",
    campus: initialValues.campus ?? "all",
    category: initialValues.category ?? "all",
    stock: initialValues.stock ?? "all",
    priceMin: initialValues.priceMin ?? "",
    priceMax: initialValues.priceMax ?? "",
  })

  const updateForm = (field: keyof typeof formValues, value: string) => {
    setFormValues((prev) => ({ ...prev, [field]: value }))
  }

  const applyFilters = () => {
    const params = new URLSearchParams(searchParams?.toString() || "")
    setParam(params, "q", formValues.search.trim())
    setParam(params, "campus", normalizeFilterValue(formValues.campus))
    setParam(params, "category", normalizeFilterValue(formValues.category))
    setParam(params, "stock", normalizeFilterValue(formValues.stock))
    setParam(params, "priceMin", formValues.priceMin.trim())
    setParam(params, "priceMax", formValues.priceMax.trim())

    startTransition(() => {
      const query = params.toString()
      router.push(query ? `${pathname}?${query}` : pathname)
    })
  }

  const resetFilters = () => {
    setFormValues({
      search: "",
      campus: "all",
      category: "all",
      stock: "all",
      priceMin: "",
      priceMax: "",
    })
    startTransition(() => router.push(pathname))
  }

  return (
    <div className="mb-6 rounded-2xl border border-primary/15 bg-white/70 p-4 shadow-sm glass-panel">
      <div className="grid gap-3 lg:grid-cols-4">
        <Input
          placeholder={t('products.searchPlaceholder')}
          value={formValues.search}
          onChange={(event) => updateForm("search", event.target.value)}
        />

        <Select value={formValues.campus} onValueChange={(value) => updateForm("campus", value)}>
          <SelectTrigger>
            <SelectValue placeholder={t('products.bulkActions.campus')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('products.bulkActions.allCampuses')}</SelectItem>
            {options.campuses.map((campus) => (
              <SelectItem key={campus.id} value={campus.id}>
                {campus.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={formValues.category} onValueChange={(value) => updateForm("category", value)}>
          <SelectTrigger>
            <SelectValue placeholder={t('products.bulkActions.category')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('products.bulkActions.allCategories')}</SelectItem>
            {options.categories.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={formValues.stock} onValueChange={(value) => updateForm("stock", value)}>
          <SelectTrigger>
            <SelectValue placeholder={t('products.bulkActions.stockStatus')} />
          </SelectTrigger>
          <SelectContent>
            {stockOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <Input
          type="number"
          placeholder={t('products.bulkActions.minPrice')}
          value={formValues.priceMin}
          onChange={(event) => updateForm("priceMin", event.target.value)}
        />
        <Input
          type="number"
          placeholder={t('products.bulkActions.maxPrice')}
          value={formValues.priceMax}
          onChange={(event) => updateForm("priceMax", event.target.value)}
        />
        <div className="flex flex-wrap gap-2 md:col-span-2 lg:col-span-2">
          <Button type="button" size="sm" onClick={applyFilters} disabled={isPending}>
            {isPending ? t('products.bulkActions.updating') : t('products.bulkActions.applyFilters')}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={resetFilters} disabled={isPending}>
            {t('products.bulkActions.reset')}
          </Button>
        </div>
      </div>
    </div>
  )
}

function setParam(params: URLSearchParams, key: string, value?: string | null) {
  if (value && value !== "all") {
    params.set(key, value)
  } else {
    params.delete(key)
  }
}

function normalizeFilterValue(value?: string) {
  if (!value || value === "all") {
    return null
  }
  return value
}

