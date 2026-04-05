import { Building2 } from "lucide-react";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { listCampuses, listDepartments } from "../_actions/departments";
import { EmptyState } from "../_components/empty-state";
import { PageHeader } from "../_components/page-header";

export default async function DepartmentsPage() {
  const t = await getTranslations("adminPortal.departments");

  const [departments, campuses] = await Promise.all([
    listDepartments(),
    listCampuses(),
  ]);

  const campusMap = new Map(campuses.map((c) => [c.$id, c.name]));

  return (
    <div className="pb-12">
      <PageHeader description={t("description")} title={t("title")} />

      {departments.length === 0 ? (
        <EmptyState
          description={t("emptyDescription")}
          icon={<Building2 size={28} />}
          title={t("empty")}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {departments.map((dept) => (
            <div
              className="group overflow-hidden rounded-3xl"
              key={dept.$id}
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.05)",
              }}
            >
              {/* Hero */}
              <div
                className="relative h-24 overflow-hidden"
                style={{ background: "rgba(61,169,224,0.05)" }}
              >
                {dept.hero ? (
                  <Image
                    alt={dept.Name}
                    className="object-cover opacity-60"
                    fill
                    src={dept.hero}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Building2
                      size={24}
                      style={{ color: "rgba(255,255,255,0.15)" }}
                    />
                  </div>
                )}
                {dept.type && (
                  <div
                    className="absolute top-2 left-2 rounded-full px-2 py-0.5 font-medium text-[10px] uppercase"
                    style={{
                      background: "rgba(0,0,0,0.60)",
                      color: "rgba(255,255,255,0.70)",
                    }}
                  >
                    {dept.type}
                  </div>
                )}
                {dept.active === false && (
                  <div
                    className="absolute top-2 right-2 rounded-full px-2 py-0.5 text-[10px]"
                    style={{
                      background: "rgba(248,113,113,0.20)",
                      color: "#f87171",
                    }}
                  >
                    Inactive
                  </div>
                )}
              </div>

              <div className="p-4">
                <p className="font-medium text-sm" style={{ color: "#fff" }}>
                  {dept.Name}
                </p>
                <p
                  className="mt-1 text-xs"
                  style={{ color: "rgba(255,255,255,0.40)" }}
                >
                  {campusMap.get(dept.campus_id) ?? dept.campus_id}
                </p>

                <div className="mt-4 flex items-center justify-between">
                  <span
                    className="text-xs"
                    style={{ color: "rgba(255,255,255,0.30)" }}
                  >
                    {t("fields.members")}: {dept.users?.length ?? 0}
                  </span>
                  <div className="flex items-center gap-2">
                    <a
                      className="text-xs transition-colors hover:text-[#3DA9E0]"
                      href={`/units/${dept.$id}`}
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
