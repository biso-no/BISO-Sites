import { notFound } from "next/navigation";
import { getAllowedCampuses } from "@/app/actions/campus";
import { getProduct } from "@/app/actions/products";
import { EditProduct } from "../_components/edit-product";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ProductEditPage({ params }: Props) {
  const { id } = await params;

  const [product, campuses] = await Promise.all([
    getProduct(id),
    getAllowedCampuses(),
  ]);

  if (!product) {
    notFound();
  }

  return <EditProduct campuses={campuses} product={product} />;
}
