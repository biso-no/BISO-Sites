import { getTranslations } from "next-intl/server";
import { listJobApplications } from "@/app/actions/jobs";

export default async function AdminJobApplications({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const apps = await listJobApplications(id);
  const t = await getTranslations("adminJobs");
  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("applications.title")}</h1>
          <p className="text-muted-foreground">
            {t("applications.summary", {
              count: apps.length,
              plural: apps.length !== 1 ? "s" : "",
            })}
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/jobs">{t("applications.back")}</Link>
        </Button>
      </header>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-3 text-left">{t("table.name")}</th>
              <th className="p-3 text-left">{t("table.email")}</th>
              <th className="p-3 text-left">{t("table.phone")}</th>
              <th className="p-3 text-left">{t("labels.appliedAt") || t("table.appliedAt")}</th>
            </tr>
          </thead>
          <tbody>
            {apps.map((a: any) => (
              <tr key={a.$id} className="border-t">
                <td className="p-3">{a.applicant_name}</td>
                <td className="p-3">{a.applicant_email}</td>
                <td className="p-3">{a.applicant_phone || "-"}</td>
                <td className="p-3">{a.applied_at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
