"use client"

import { useState, useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

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

const STOCK_OPTIONS = [
  { value: "all", label: "Alle nivåer" },
  { value: "in-stock", label: "På lager" },
  { value: "low-stock", label: "Lavt lager" },
  { value: "out-of-stock", label: "Utsolgt" },
]

export function ProductFilters({ initialValues, options }: ProductFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
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
    <div className="mb-6 rounded-2xl border border-primary/15 bg-white/70 p-4 shadow-sm">
      <div className="grid gap-3 lg:grid-cols-4">
        <Input
          placeholder="Søk etter produkt eller slug"
          value={formValues.search}
          onChange={(event) => updateForm("search", event.target.value)}
        />

        <Select value={formValues.campus} onValueChange={(value) => updateForm("campus", value)}>
          <SelectTrigger>
            <SelectValue placeholder="Campus" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle campus</SelectItem>
            {options.campuses.map((campus) => (
              <SelectItem key={campus.id} value={campus.id}>
                {campus.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={formValues.category} onValueChange={(value) => updateForm("category", value)}>
          <SelectTrigger>
            <SelectValue placeholder="Kategori" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle kategorier</SelectItem>
            {options.categories.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={formValues.stock} onValueChange={(value) => updateForm("stock", value)}>
          <SelectTrigger>
            <SelectValue placeholder="Lagerstatus" />
          </SelectTrigger>
          <SelectContent>
            {STOCK_OPTIONS.map((option) => (
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
          placeholder="Min. pris"
          value={formValues.priceMin}
          onChange={(event) => updateForm("priceMin", event.target.value)}
        />
        <Input
          type="number"
          placeholder="Maks pris"
          value={formValues.priceMax}
          onChange={(event) => updateForm("priceMax", event.target.value)}
        />
        <div className="flex flex-wrap gap-2 md:col-span-2 lg:col-span-2">
          <Button type="button" size="sm" onClick={applyFilters} disabled={isPending}>
            {isPending ? "Oppdaterer..." : "Bruk filtre"}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={resetFilters} disabled={isPending}>
            Nullstill
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

