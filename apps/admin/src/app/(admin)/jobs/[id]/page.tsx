import { notFound } from "next/navigation";
import { getAllowedCampuses } from "@/app/actions/campus";
import { listDepartments } from "@/app/actions/events";
import { getJob } from "@/app/actions/jobs";
import JobEditor from "../shared/job-editor";

export default async function EditJobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [job, campuses, departments] = await Promise.all([
    getJob(id),
    getAllowedCampuses(),
    listDepartments(),
  ]);

  if (!job) {
    notFound();
  }

  return <JobEditor campuses={campuses} departments={departments} job={job} />;
}
