"use client";

import type {
  ContentTranslations,
  WebshopProducts,
} from "@repo/api/types/appwrite";
import { AlertTriangle, Pencil, ShoppingCart, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteProduct } from "../../_actions/shop";
import { EmptyState } from "../../_components/empty-state";
import { SearchToolbar } from "../../_components/search-toolbar";
import { StatusBadge } from "../../_components/status-badge";

type ProductWithTranslations = WebshopProducts & {
  translation_refs: ContentTranslations[];
};

type ShopListClientProps = {
  initialProducts: ProductWithTranslations[];
  labels: {
    empty: string;
    emptyDescription: string;
    searchPlaceholder: string;
    all: string;
    published: string;
    draft: string;
    pending: string;
    archived: string;
    edit: string;
    delete: string;
    deleteConfirm: string;
    lowStock: string;
  };
};

export function ShopListClient({
  initialProducts,
  labels,
}: ShopListClientProps) {
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [, startTransition] = useTransition();

  const filters = [
    { label: labels.all, value: "all" },
    { label: labels.published, value: "published" },
    { label: labels.draft, value: "draft" },
    { label: labels.pending, value: "pending_approval" },
    { label: labels.archived, value: "archived" },
  ];

  function getTitle(p: ProductWithTranslations) {
    return (
      p.translation_refs.find((t) => t.locale === "no")?.title ?? "Untitled"
    );
  }

  const filtered = initialProducts.filter((p) => {
    const title = getTitle(p);
    return (
      (!search || title.toLowerCase().includes(search.toLowerCase())) &&
      (activeFilter === "all" || p.status === activeFilter)
    );
  });

  function handleDelete(id: string) {
    if (!confirm(labels.deleteConfirm)) {
      return;
    }
    startTransition(async () => {
      const result = await deleteProduct(id);
      if (result.error) {
        toast.error("Failed to delete product");
      } else {
        toast.success("Product deleted");
      }
    });
  }

  if (initialProducts.length === 0) {
    return (
      <EmptyState
        description={labels.emptyDescription}
        icon={<ShoppingCart size={28} />}
        title={labels.empty}
      >
        <Link
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 font-medium text-sm"
          href="/admin/shop/new"
          style={{ background: "#3DA9E0", color: "#001731" }}
        >
          Add first product
        </Link>
      </EmptyState>
    );
  }

  return (
    <>
      <SearchToolbar
        activeFilter={activeFilter}
        filters={filters}
        onFilterChange={setActiveFilter}
        onSearch={setSearch}
        placeholder={labels.searchPlaceholder}
      />
      {filtered.length === 0 ? (
        <EmptyState
          icon={<ShoppingCart size={28} />}
          title="No matching products"
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {filtered.map((product) => (
            <div
              className="group overflow-hidden rounded-3xl"
              key={product.$id}
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.05)",
              }}
            >
              <div
                className="relative h-32 overflow-hidden"
                style={{ background: "rgba(255,255,255,0.03)" }}
              >
                {product.image ? (
                  <img
                    alt={getTitle(product)}
                    className="h-full w-full object-cover"
                    src={product.image}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <ShoppingCart
                      size={20}
                      style={{ color: "rgba(255,255,255,0.20)" }}
                    />
                  </div>
                )}
                <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <Link
                    className="flex h-6 w-6 items-center justify-center rounded-lg"
                    href={`/admin/shop/${product.$id}`}
                    style={{ background: "rgba(0,0,0,0.70)", color: "#fff" }}
                  >
                    <Pencil size={11} />
                  </Link>
                  <button
                    className="flex h-6 w-6 items-center justify-center rounded-lg"
                    onClick={() => handleDelete(product.$id)}
                    style={{ background: "rgba(0,0,0,0.70)", color: "#f87171" }}
                    type="button"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
                {(product.stock ?? 0) < 5 && product.stock !== null && (
                  <div
                    className="absolute top-2 left-2 flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px]"
                    style={{
                      background: "rgba(251,191,36,0.20)",
                      color: "#fbbf24",
                    }}
                  >
                    <AlertTriangle size={9} />
                    {labels.lowStock}
                  </div>
                )}
              </div>
              <div className="p-3">
                <Link
                  className="block truncate font-medium text-xs transition-colors hover:text-[#3DA9E0]"
                  href={`/admin/shop/${product.$id}`}
                  style={{ color: "#fff" }}
                >
                  {getTitle(product)}
                </Link>
                <div className="mt-1.5 flex items-center justify-between">
                  <span
                    className="font-mono text-xs"
                    style={{ color: "#3DA9E0" }}
                  >
                    {product.regular_price} NOK
                  </span>
                  <StatusBadge size="sm" status={product.status} />
                </div>
                {product.stock !== null && (
                  <p
                    className="mt-1 text-[10px]"
                    style={{ color: "rgba(255,255,255,0.30)" }}
                  >
                    Stock: {product.stock}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
