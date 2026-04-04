import { getTranslations } from "next-intl/server";
import { Building2 } from "lucide-react";
import { listDepartments, listCampuses } from "../_actions/departments";
import { PageHeader } from "../_components/page-header";
import { EmptyState } from "../_components/empty-state";

export default async function DepartmentsPage() {
  const t = await getTranslations("adminPortal.departments");

  const [departments, campuses] = await Promise.all([
    listDepartments(),
    listCampuses(),
  ]);

  const campusMap = new Map(campuses.map((c) => [c.$id, c.name]));

  return (
    <div className="pb-12">
      <PageHeader title={t("title")} description={t("description")} />

      {departments.length === 0 ? (
        <EmptyState
          icon={<Building2 size={28} />}
          title={t("empty")}
          description={t("emptyDescription")}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {departments.map((dept) => (
            <div
              key={dept.$id}
              className="group rounded-3xl overflow-hidden"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
            >
              {/* Hero */}
              <div className="relative h-24 overflow-hidden" style={{ background: "rgba(61,169,224,0.05)" }}>
                {dept.hero ? (
                  <img src={dept.hero} alt={dept.Name} className="w-full h-full object-cover opacity-60" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Building2 size={24} style={{ color: "rgba(255,255,255,0.15)" }} />
                  </div>
                )}
                {dept.type && (
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-medium uppercase" style={{ background: "rgba(0,0,0,0.60)", color: "rgba(255,255,255,0.70)" }}>
                    {dept.type}
                  </div>
                )}
                {dept.active === false && (
                  <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px]" style={{ background: "rgba(248,113,113,0.20)", color: "#f87171" }}>
                    Inactive
                  </div>
                )}
              </div>

              <div className="p-4">
                <p className="font-medium text-sm" style={{ color: "#fff" }}>{dept.Name}</p>
                <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.40)" }}>
                  {campusMap.get(dept.campus_id) ?? dept.campus_id}
                </p>

                <div className="flex items-center justify-between mt-4">
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.30)" }}>
                    {t("fields.members")}: {dept.users?.length ?? 0}
                  </span>
                  <div className="flex items-center gap-2">
                    <a
                      href={`/units/${dept.$id}`}
                      className="text-xs hover:text-[#3DA9E0] transition-colors"
                      style={{ color: "rgba(255,255,255,0.40)" }}
                    >
                      {t("actions.editPage")} →
                    </a>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
