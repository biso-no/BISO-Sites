import { notFound } from "next/navigation";
import { getRecruitmentWorkspace } from "./_actions/recruitment-workspace";
import { RecruitShell } from "./_components/recruitment/recruit-shell";

interface VacancyApplicationsPageProps {
  params: Promise<{ id: string }>;
}

export default async function VacancyApplicationsPage({
  params,
}: VacancyApplicationsPageProps) {
  const { id } = await params;
  const workspace = await getRecruitmentWorkspace(id).catch(() => null);

  if (!workspace) {
    notFound();
  }

  return (
    <div className="-mx-5 -my-7 md:-mx-9 md:-my-9">
      <RecruitShell data={workspace} />
    </div>
  );
}
