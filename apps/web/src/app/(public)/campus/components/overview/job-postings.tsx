import type { ContentTranslations } from "@repo/api/types/appwrite";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { Building2, Calendar, ChevronRight } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import type { Locale } from "@/i18n/config";

interface JobPostingsProps {
  jobs: ContentTranslations[];
  locale: Locale;
}

export function JobPostings({ jobs, locale }: JobPostingsProps) {
  if (!jobs || jobs.length === 0) {
    return null;
  }

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString(locale === "en" ? "en-US" : "nb-NO", {
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-gray-900">
          {locale === "en" ? "Open Positions" : "Ledige verv"}
        </h2>
        <Button variant="ghost" size="sm" className="text-[#3DA9E0]">
          <Link href="/jobs" className="flex items-center">
            {locale === "en" ? "View All" : "Se alle"}
            <ChevronRight className="w-4 h-4 ml-1" />
          </Link>
        </Button>
      </div>

      <div className="space-y-4">
        {jobs.slice(0, 3).map((job, index) => (
          <motion.div
            key={job.$id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Link href={`/jobs/${job.job_ref?.slug}`}>
              <Card className="p-6 border-0 shadow-md hover:shadow-lg transition-all cursor-pointer group hover:border-l-4 hover:border-l-[#3DA9E0]">
                <h4 className="text-gray-900 mb-2 group-hover:text-[#3DA9E0] transition-colors">
                  {job.title}
                </h4>
                <div className="flex items-center gap-4 text-sm text-gray-600 flex-wrap">
                  {job.job_ref?.department?.Name && (
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-[#3DA9E0]" />
                      {job.job_ref.department.Name}
                    </div>
                  )}
                  {job.job_ref?.metadata?.application_deadline && (
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-[#3DA9E0]" />
                      {locale === "en" ? "Deadline:" : "Søknadsfrist:"}{" "}
                      {formatDate(job.job_ref.metadata.application_deadline)}
                    </div>
                  )}
                </div>
              </Card>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
