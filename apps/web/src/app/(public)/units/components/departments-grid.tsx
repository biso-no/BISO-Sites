import type { ContentTranslations } from "@repo/api/types/appwrite";
import { DepartmentCard } from "./department-card";

interface DepartmentsGridProps {
  departments: ContentTranslations[];
}

export function DepartmentsGrid({ departments }: DepartmentsGridProps) {
  if (departments.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        Fant ingen enheter med disse filtrene. Juster søket ditt eller velg en annen campus.
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
      {departments.map((dept, index) => (
        <DepartmentCard key={dept.$id} department={dept} index={index} />
      ))}
    </div>
  );
}
