import type { ContentTranslations } from "@repo/api/types/appwrite";
import { DepartmentCard } from "./department-card";

type DepartmentsGridProps = {
  departments: ContentTranslations[];
};

export function DepartmentsGrid({ departments }: DepartmentsGridProps) {
  if (departments.length === 0) {
    return (
      <div className="rounded-3xl border border-border border-dashed p-10 text-center text-muted-foreground text-sm">
        Fant ingen enheter med disse filtrene. Juster søket ditt eller velg en
        annen campus.
      </div>
    );
  }

  return (
    <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
      {departments.map((dept, index) => (
        <DepartmentCard department={dept} index={index} key={dept.$id} />
      ))}
    </div>
  );
}
