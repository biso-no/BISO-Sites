import { getAllowedCampuses } from "@/app/actions/campus";
import { EditProduct } from "../_components/edit-product";

export default async function NewProductPage() {
  const campuses = await getAllowedCampuses();
  return <EditProduct campuses={campuses} />;
}
