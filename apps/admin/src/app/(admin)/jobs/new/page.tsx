import { getAllowedCampuses } from "@/app/actions/campus";
import { listDepartments } from "@/app/actions/events";
import JobEditor from "../shared/job-editor";

export default async function NewJobPage() {
  const [campuses, departments] = await Promise.all([
    getAllowedCampuses(),
    listDepartments(),
  ]);
  return <JobEditor campuses={campuses} departments={departments} />;
}
