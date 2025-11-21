import { notFound } from "next/navigation";
import { getCampuses } from "@/app/actions/campus";
import {
  getDepartmentById,
  getDepartmentTypes,
} from "@/lib/actions/departments";
import DepartmentEditor from "../shared/department-editor";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function DepartmentEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [department, campuses, types] = await Promise.all([
    getDepartmentById(id),
    getCampuses(),
    getDepartmentTypes(),
  ]);

  if (!department) {
    notFound();
  }

  return (
    <DepartmentEditor
      campuses={campuses.map((c) => ({ $id: c.$id, name: c.name }))}
      department={department}
      types={types}
    />
  );
}
