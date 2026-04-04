import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { getProduct } from "../../_actions/shop";
import { listCampuses } from "../../_actions/jobs";
import { ShopEditorClient } from "./_components/shop-editor-client";

type Props = { params: Promise<{ id: string }> };

export default async function ShopEditorPage({ params }: Props) {
  const { id } = await params;
  const t = await getTranslations("adminPortal.shop");

  const isNew = id === "new";
  const [product, campuses] = await Promise.all([
    isNew ? null : getProduct(id),
    listCampuses(),
  ]);

  if (!isNew && !product) notFound();

  return (
    <ShopEditorClient
      product={product}
      campuses={campuses}
      isNew={isNew}
      labels={{
        back: t("title"),
        name: t("fields.name"),
        category: t("fields.category"),
        price: t("fields.price"),
        memberPrice: t("fields.memberPrice"),
        description: t("fields.description"),
        image: t("fields.image"),
        stock: t("fields.stock"),
        status: t("fields.status"),
        campus: "Campus",
        discard: "Discard",
        saveDraft: "Save Draft",
        publish: "Publish",
        preview: t("preview"),
        saveSuccess: t("saveSuccess"),
        saveError: t("saveError"),
        publishSuccess: t("publishSuccess"),
      }}
    />
  );
}
