import { Plus } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { listProducts } from "../_actions/shop";
import { PageHeader } from "../_components/page-header";
import { ShopListClient } from "./_components/shop-list-client";

export default async function ShopPage() {
  const t = await getTranslations("adminPortal.shop");
  const tc = await getTranslations("adminPortal.common");

  const products = await listProducts();

  return (
    <div className="pb-12">
      <PageHeader description={t("description")} title={t("title")}>
        <Link
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 font-medium text-sm"
          href="/shop/new"
          style={{
            background: "#3DA9E0",
            color: "#001731",
            boxShadow: "0 0 20px rgba(61,169,224,0.25)",
          }}
        >
          <Plus size={15} />
          {t("create")}
        </Link>
      </PageHeader>
      <ShopListClient
        initialProducts={products}
        labels={{
          empty: t("empty"),
          emptyDescription: t("emptyDescription"),
          searchPlaceholder: tc("search"),
          all: tc("all"),
          published: tc("status.published"),
          draft: tc("status.draft"),
          pending: tc("status.pending_approval"),
          archived: tc("status.archived"),
          edit: t("actions.edit"),
          delete: t("actions.delete"),
          deleteConfirm: tc("confirmDelete"),
          lowStock: t("fields.lowStock"),
        }}
      />
    </div>
  );
}
