import { Building2 } from "lucide-react";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { requireNavAccess } from "@/lib/authorization";
import { listDepartments } from "../_actions/departments";
import { listCampuses } from "../_actions/lookups";
import { EmptyState } from "../_components/empty-state";
import { PageHeader } from "../_components/page-header";
import { SERIF_STACK, STUDIO, StudioIconBox } from "../_components/studio";

export default async function DepartmentsPage() {
  await requireNavAccess("portal.departments");
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
              className="group overflow-hidden rounded-2xl border transition hover:bg-white/70"
              key={dept.$id}
              style={{
                background: "rgba(255,255,255,0.46)",
                borderColor: STUDIO.rule,
              }}
            >
              <div
                className="relative h-24 overflow-hidden"
                style={{ background: STUDIO.paper2 }}
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
                    <StudioIconBox color={STUDIO.claret}>
                      <Building2 size={18} />
                    </StudioIconBox>
                  </div>
                )}
                {dept.type && (
                  <div
                    className="absolute top-2 left-2 rounded-full px-2 py-0.5 font-medium text-[10px] uppercase"
                    style={{
                      background: "rgba(250,247,242,0.9)",
                      color: STUDIO.ink3,
                    }}
                  >
                    {dept.type}
                  </div>
                )}
                {dept.active === false && (
                  <div
                    className="absolute top-2 right-2 rounded-full px-2 py-0.5 text-[10px]"
                    style={{
                      background: "rgba(107,30,30,0.10)",
                      color: STUDIO.claret,
                    }}
                  >
                    Inactive
                  </div>
                )}
              </div>

              <div className="p-4">
                <p
                  className="text-2xl leading-7"
                  style={{ color: STUDIO.ink, fontFamily: SERIF_STACK }}
                >
                  {dept.Name}
                </p>
                <p className="mt-1 text-xs" style={{ color: STUDIO.ink3 }}>
                  {campusMap.get(dept.campus_id) ?? dept.campus_id}
                </p>

                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs" style={{ color: STUDIO.ink4 }}>
                    {t("fields.members")}: {dept.users?.length ?? 0}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
