import { notFound } from "next/navigation";
import { listCampuses, listDepartmentsForCampus } from "../../_actions/lookups";
import { getProduct } from "../../_actions/shop";
import { ShopStudioEditor } from "./_components/shop-studio-editor";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ShopEditorPage({ params }: Props) {
  const { id } = await params;
  const isNew = id === "new";

  const [product, campuses] = await Promise.all([
    isNew ? null : getProduct(id),
    listCampuses(),
  ]);

  if (!(isNew || product)) {
    notFound();
  }

  const defaultCampusId = campuses[0]?.$id ?? "";
  const campusIdForDepts = product?.campus_id ?? defaultCampusId;
  const departments = campusIdForDepts
    ? await listDepartmentsForCampus(campusIdForDepts)
    : [];

  return (
    <ShopStudioEditor
      campuses={campuses}
      departments={departments}
      isNew={isNew}
      product={product}
    />
  );
}
