import { listCampuses, listDepartments } from "@/app/actions/events";
import JobEditor from "../shared/JobEditor";

export default async function NewJobPage() {
  const [campuses, departments] = await Promise.all([listCampuses(), listDepartments()]);
  return <JobEditor campuses={campuses as any} departments={departments as any} />;
}
