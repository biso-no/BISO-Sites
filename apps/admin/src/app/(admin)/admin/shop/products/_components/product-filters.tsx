"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

type ProductFiltersProps = {
  initialValues: {
    search?: string;
    campus?: string;
    category?: string;
    stock?: string;
    priceMin?: string;
    priceMax?: string;
  };
  options: {
    campuses: { id: string; name: string }[];
    categories: string[];
  };
};

export function ProductFilters({
  initialValues,
  options,
}: ProductFiltersProps) {
  const t = useTranslations("adminShop");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const stockOptions = [
    { value: "all", label: t("products.stockStatus.allLevels") },
    { value: "in-stock", label: t("products.stockStatus.inStock") },
    { value: "low-stock", label: t("products.stockStatus.lowStock") },
    { value: "out-of-stock", label: t("products.stockStatus.outOfStock") },
  ];
  const [formValues, setFormValues] = useState({
    search: initialValues.search ?? "",
    campus: initialValues.campus ?? "all",
    category: initialValues.category ?? "all",
    stock: initialValues.stock ?? "all",
    priceMin: initialValues.priceMin ?? "",
    priceMax: initialValues.priceMax ?? "",
  });

  const updateForm = (field: keyof typeof formValues, value: string) => {
    setFormValues((prev) => ({ ...prev, [field]: value }));
  };

  const applyFilters = () => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    setParam(params, "q", formValues.search.trim());
    setParam(params, "campus", normalizeFilterValue(formValues.campus));
    setParam(params, "category", normalizeFilterValue(formValues.category));
    setParam(params, "stock", normalizeFilterValue(formValues.stock));
    setParam(params, "priceMin", formValues.priceMin.trim());
    setParam(params, "priceMax", formValues.priceMax.trim());

    startTransition(() => {
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname);
    });
  };

  const resetFilters = () => {
    setFormValues({
      search: "",
      campus: "all",
      category: "all",
      stock: "all",
      priceMin: "",
      priceMax: "",
    });
    startTransition(() => router.push(pathname));
  };

  return (
    <div className="glass-panel mb-6 rounded-2xl border border-primary/15 bg-white/70 p-4 shadow-sm">
      <div className="grid gap-3 lg:grid-cols-4">
        <Input
          onChange={(event) => updateForm("search", event.target.value)}
          placeholder={t("products.searchPlaceholder")}
          value={formValues.search}
        />

        <Select
          onValueChange={(value) => updateForm("campus", value)}
          value={formValues.campus}
        >
          <SelectTrigger>
            <SelectValue placeholder={t("products.bulkActions.campus")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              {t("products.bulkActions.allCampuses")}
            </SelectItem>
            {options.campuses.map((campus) => (
              <SelectItem key={campus.id} value={campus.id}>
                {campus.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          onValueChange={(value) => updateForm("category", value)}
          value={formValues.category}
        >
          <SelectTrigger>
            <SelectValue placeholder={t("products.bulkActions.category")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              {t("products.bulkActions.allCategories")}
            </SelectItem>
            {options.categories.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          onValueChange={(value) => updateForm("stock", value)}
          value={formValues.stock}
        >
          <SelectTrigger>
            <SelectValue placeholder={t("products.bulkActions.stockStatus")} />
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
          onChange={(event) => updateForm("priceMin", event.target.value)}
          placeholder={t("products.bulkActions.minPrice")}
          type="number"
          value={formValues.priceMin}
        />
        <Input
          onChange={(event) => updateForm("priceMax", event.target.value)}
          placeholder={t("products.bulkActions.maxPrice")}
          type="number"
          value={formValues.priceMax}
        />
        <div className="flex flex-wrap gap-2 md:col-span-2 lg:col-span-2">
          <Button
            disabled={isPending}
            onClick={applyFilters}
            size="sm"
            type="button"
          >
            {isPending
              ? t("products.bulkActions.updating")
              : t("products.bulkActions.applyFilters")}
          </Button>
          <Button
            disabled={isPending}
            onClick={resetFilters}
            size="sm"
            type="button"
            variant="ghost"
          >
            {t("products.bulkActions.reset")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function setParam(params: URLSearchParams, key: string, value?: string | null) {
  if (value && value !== "all") {
    params.set(key, value);
  } else {
    params.delete(key);
  }
}

function normalizeFilterValue(value?: string) {
  if (!value || value === "all") {
    return null;
  }
  return value;
}
