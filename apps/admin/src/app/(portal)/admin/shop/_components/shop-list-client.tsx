"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ShoppingCart, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { deleteProduct } from "../../_actions/shop";
import { SearchToolbar } from "../../_components/search-toolbar";
import { StatusBadge } from "../../_components/status-badge";
import { EmptyState } from "../../_components/empty-state";
import type { WebshopProducts, ContentTranslations } from "@repo/api/types/appwrite";

type ProductWithTranslations = WebshopProducts & { translation_refs: ContentTranslations[] };

type ShopListClientProps = {
  initialProducts: ProductWithTranslations[];
  labels: { empty: string; emptyDescription: string; searchPlaceholder: string; all: string; published: string; draft: string; pending: string; archived: string; edit: string; delete: string; deleteConfirm: string; lowStock: string; };
};

export function ShopListClient({ initialProducts, labels }: ShopListClientProps) {
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
    return p.translation_refs.find((t) => t.locale === "no")?.title ?? "Untitled";
  }

  const filtered = initialProducts.filter((p) => {
    const title = getTitle(p);
    return (!search || title.toLowerCase().includes(search.toLowerCase())) && (activeFilter === "all" || p.status === activeFilter);
  });

  function handleDelete(id: string) {
    if (!confirm(labels.deleteConfirm)) return;
    startTransition(async () => {
      const result = await deleteProduct(id);
      if (result.error) { toast.error("Failed to delete product"); } else { toast.success("Product deleted"); }
    });
  }

  if (initialProducts.length === 0) {
    return (
      <EmptyState icon={<ShoppingCart size={28} />} title={labels.empty} description={labels.emptyDescription}>
        <Link href="/admin/shop/new" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium" style={{ background: "#3DA9E0", color: "#001731" }}>Add first product</Link>
      </EmptyState>
    );
  }

  return (
    <>
      <SearchToolbar placeholder={labels.searchPlaceholder} onSearch={setSearch} filters={filters} activeFilter={activeFilter} onFilterChange={setActiveFilter} />
      {filtered.length === 0 ? (
        <EmptyState icon={<ShoppingCart size={28} />} title="No matching products" />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {filtered.map((product) => (
            <div key={product.$id} className="group rounded-3xl overflow-hidden" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div className="relative h-32 overflow-hidden" style={{ background: "rgba(255,255,255,0.03)" }}>
                {product.image ? <img src={product.image} alt={getTitle(product)} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><ShoppingCart size={20} style={{ color: "rgba(255,255,255,0.20)" }} /></div>}
                <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Link href={`/admin/shop/${product.$id}`} className="flex items-center justify-center w-6 h-6 rounded-lg" style={{ background: "rgba(0,0,0,0.70)", color: "#fff" }}><Pencil size={11} /></Link>
                  <button type="button" onClick={() => handleDelete(product.$id)} className="flex items-center justify-center w-6 h-6 rounded-lg" style={{ background: "rgba(0,0,0,0.70)", color: "#f87171" }}><Trash2 size={11} /></button>
                </div>
                {(product.stock ?? 0) < 5 && product.stock !== null && (
                  <div className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px]" style={{ background: "rgba(251,191,36,0.20)", color: "#fbbf24" }}>
                    <AlertTriangle size={9} />{labels.lowStock}
                  </div>
                )}
              </div>
              <div className="p-3">
                <Link href={`/admin/shop/${product.$id}`} className="text-xs font-medium truncate block hover:text-[#3DA9E0] transition-colors" style={{ color: "#fff" }}>{getTitle(product)}</Link>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-xs font-mono" style={{ color: "#3DA9E0" }}>{product.regular_price} NOK</span>
                  <StatusBadge status={product.status} size="sm" />
                </div>
                {product.stock !== null && (
                  <p className="text-[10px] mt-1" style={{ color: "rgba(255,255,255,0.30)" }}>Stock: {product.stock}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
