import type { ContentTranslations } from "@repo/api/types/appwrite";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { Building2 } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import type { Locale } from "@/i18n/config";

type DepartmentsGridProps = {
  departments: ContentTranslations[];
  locale: Locale;
  activeCampusId?: string | null;
};

export function DepartmentsGrid({
  departments,
  locale,
  activeCampusId,
}: DepartmentsGridProps) {
  if (!departments || departments.length === 0) {
    return null;
  }

  return (
    <section>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="mb-2 font-bold text-2xl text-foreground">
            {locale === "en" ? "Our Departments" : "Våre enheter"}
          </h2>
          <p className="text-muted-foreground">
            {locale === "en"
              ? "Active student organizations and committees"
              : "Aktive studentorganisasjoner og komiteer"}
          </p>
        </div>
        <Button className="text-[#3DA9E0]" size="sm" variant="ghost">
          <Link
            href={
              activeCampusId ? `/units?campus_id=${activeCampusId}` : "/units"
            }
          >
            {locale === "en" ? "See All Units" : "Se alle enheter"}
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {departments.slice(0, 8).map((dept, index) => (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            initial={{ opacity: 0, y: 20 }}
            key={dept.$id}
            transition={{ delay: index * 0.1 }}
          >
            <Link
              href={`/units/${dept.department_ref?.$id || dept.content_id}`}
            >
              <Card className="group cursor-pointer border-0 p-6 text-center shadow-lg transition-all hover:shadow-xl">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-linear-to-br from-[#3DA9E0] to-[#001731] transition-transform group-hover:scale-110">
                  <Building2 className="h-8 w-8 text-white" />
                </div>
                <h4 className="mb-2 font-semibold text-foreground">
                  {dept.title}
                </h4>
                {dept.short_description && (
                  <p className="line-clamp-2 text-muted-foreground text-sm">
                    {dept.short_description}
                  </p>
                )}
                {dept.department_ref?.type && (
                  <Badge
                    className="mt-3 border-border text-xs"
                    variant="outline"
                  >
                    {dept.department_ref.type}
                  </Badge>
                )}
              </Card>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
