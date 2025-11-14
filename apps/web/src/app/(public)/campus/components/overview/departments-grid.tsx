import { motion } from "motion/react";
import { Building2 } from "lucide-react";
import Link from "next/link";
import { Card } from "@repo/ui/components/ui/card";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import type { Departments } from "@repo/api/types/appwrite";
import type { Locale } from "@/i18n/config";

interface DepartmentsGridProps {
  departments: Departments[];
  locale: Locale;
  activeCampusId?: string | null;
}

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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-gray-900 mb-2">
            {locale === "en" ? "Our Departments" : "Våre enheter"}
          </h2>
          <p className="text-gray-600">
            {locale === "en"
              ? "Active student organizations and committees"
              : "Aktive studentorganisasjoner og komiteer"}
          </p>
        </div>
        <Button variant="ghost" size="sm" className="text-[#3DA9E0]">
          <Link
            href={activeCampusId ? `/units?campus_id=${activeCampusId}` : "/units"}
          >
            {locale === "en" ? "See All Units" : "Se alle enheter"}
          </Link>
        </Button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {departments.slice(0, 8).map((dept, index) => (
          <motion.div
            key={dept.$id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="p-6 border-0 shadow-lg hover:shadow-xl transition-all text-center group cursor-pointer">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#3DA9E0] to-[#001731] flex items-center justify-center group-hover:scale-110 transition-transform">
                <Building2 className="w-8 h-8 text-white" />
              </div>
              <h4 className="text-gray-900 mb-2">{dept.Name}</h4>
              {dept.description && (
                <p
                  className="text-sm text-gray-600 line-clamp-2"
                  dangerouslySetInnerHTML={{ __html: dept.description }}
                />
              )}
              {dept.type && (
                <Badge
                  variant="outline"
                  className="mt-3 text-xs text-gray-500 border-gray-200"
                >
                  {dept.type}
                </Badge>
              )}
            </Card>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

