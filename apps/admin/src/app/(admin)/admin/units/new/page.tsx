import { getCampuses } from "@/app/actions/campus";
import { getDepartmentTypes } from "@/lib/actions/departments";
import DepartmentEditor from "../shared/department-editor";

export default async function NewDepartmentPage() {
  const [campuses, types] = await Promise.all([
    getCampuses(),
    getDepartmentTypes(),
  ]);

  return (
    <DepartmentEditor
      campuses={campuses.map((c) => ({ $id: c.$id, name: c.name }))}
      types={types}
    />
  );
}
