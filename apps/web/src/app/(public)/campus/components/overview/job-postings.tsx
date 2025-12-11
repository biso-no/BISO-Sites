import type { ContentTranslations } from "@repo/api/types/appwrite";
import type { Locale } from "@repo/i18n/config";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { Building2, Calendar, ChevronRight } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";

type JobPostingsProps = {
  jobs: ContentTranslations[];
  locale: Locale;
};

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
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-foreground">
          {locale === "en" ? "Open Positions" : "Ledige verv"}
        </h2>
        <Button className="text-brand" size="sm" variant="ghost">
          <Link className="flex items-center" href="/jobs">
            {locale === "en" ? "View All" : "Se alle"}
            <ChevronRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </div>

      <div className="space-y-4">
        {jobs.slice(0, 3).map((job, index) => (
          <motion.div
            animate={{ opacity: 1, x: 0 }}
            initial={{ opacity: 0, x: 20 }}
            key={job.$id}
            transition={{ delay: index * 0.1 }}
          >
            <Link href={`/jobs/${job.job_ref?.slug}`}>
              <Card className="group cursor-pointer border-0 p-6 shadow-md transition-all hover:border-l-4 hover:border-l-brand hover:shadow-lg">
                <h4 className="mb-2 text-foreground transition-colors group-hover:text-brand">
                  {job.title}
                </h4>
                <div className="flex flex-wrap items-center gap-4 text-muted-foreground text-sm">
                  {job.job_ref?.department?.Name && (
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-brand" />
                      {job.job_ref.department.Name}
                    </div>
                  )}
                  {job.job_ref?.metadata?.application_deadline && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-brand" />
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
