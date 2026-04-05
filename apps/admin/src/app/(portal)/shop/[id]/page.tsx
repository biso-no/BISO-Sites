import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { listCampuses } from "../../_actions/jobs";
import { getProduct } from "../../_actions/shop";
import { ShopEditorClient } from "./_components/shop-editor-client";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ShopEditorPage({ params }: Props) {
  const { id } = await params;
  const t = await getTranslations("adminPortal.shop");

  const isNew = id === "new";
  const [product, campuses] = await Promise.all([
    isNew ? null : getProduct(id),
    listCampuses(),
  ]);

  if (!(isNew || product)) {
    notFound();
  }

  return (
    <ShopEditorClient
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
      product={product}
    />
  );
}
