"use client";

import type { RecruitmentVacancy } from "@repo/shared/types/recruitment";
import { PlateContentRenderer } from "@repo/ui/components/plate-content-renderer";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { Separator } from "@repo/ui/components/ui/separator";
import {
  ArrowLeft,
  Calendar,
  Clock3,
  Mail,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { JobApplicationForm } from "./job-application-form";

interface JobDetailsClientProps {
  applicantEmail?: string;
  applicantName?: string;
  isAuthenticated: boolean;
  job: RecruitmentVacancy;
}

export function JobDetailsClient({
  applicantEmail,
  applicantName,
  isAuthenticated,
  job,
}: JobDetailsClientProps) {
  const router = useRouter();
  const translation = job.translation_refs[0];
  const title = translation?.title ?? "Untitled";
  const description = translation?.description ?? "";
  const deadline = job.metadata.application_deadline
    ? new Date(job.metadata.application_deadline).toLocaleDateString("en-GB")
    : "Rolling";
  const department = job.department?.Name || "BISO";
  const company = job.metadata.company || "BISO";
  const employmentType = job.metadata.employment_type || "Position";

  return (
    <div className="min-h-screen bg-linear-to-b from-section to-background">
      <section className="border-border/60 border-b bg-linear-to-br from-brand-gradient-from/10 to-brand-gradient-to/10">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <Button
            className="mb-6"
            onClick={() => router.push("/jobs")}
            variant="ghost"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to vacancies
          </Button>

          <div className="max-w-3xl space-y-4">
            <Badge variant="outline">{employmentType}</Badge>
            <h1 className="font-semibold text-4xl text-foreground md:text-5xl">
              {title}
            </h1>
            <p className="text-lg text-muted-foreground">
              {company} · {department}
            </p>
            <div className="flex flex-wrap gap-3 text-muted-foreground text-sm">
              {job.metadata.location ? (
                <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-4 py-2">
                  <MapPin className="h-4 w-4" />
                  {job.metadata.location}
                </span>
              ) : null}
              <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-4 py-2">
                <Calendar className="h-4 w-4" />
                Apply by {deadline}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-4 py-2">
                <Clock3 className="h-4 w-4" />
                {job.metadata.paid ? "Paid role" : "Volunteer role"}
              </span>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="space-y-8 lg:col-span-2">
            <Card className="border-border/60 p-8 shadow-sm">
              <h2 className="font-semibold text-2xl text-foreground">
                About the vacancy
              </h2>
              <PlateContentRenderer
                className="mt-6 text-muted-foreground"
                value={description}
              />
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="border-border/60 p-6 shadow-sm">
              <h3 className="font-semibold text-foreground text-xl">
                Vacancy details
              </h3>
              <div className="mt-4 space-y-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Employer</p>
                  <p className="font-medium text-foreground">{company}</p>
                </div>
                <Separator />
                <div>
                  <p className="text-muted-foreground">Department</p>
                  <p className="font-medium text-foreground">{department}</p>
                </div>
                <Separator />
                <div>
                  <p className="text-muted-foreground">Deadline</p>
                  <p className="font-medium text-foreground">{deadline}</p>
                </div>
                {job.metadata.location ? (
                  <>
                    <Separator />
                    <div>
                      <p className="text-muted-foreground">Location</p>
                      <p className="font-medium text-foreground">
                        {job.metadata.location}
                      </p>
                    </div>
                  </>
                ) : null}
                {job.metadata.contact_email ? (
                  <>
                    <Separator />
                    <div>
                      <p className="text-muted-foreground">Contact</p>
                      <a
                        className="inline-flex items-center gap-2 font-medium text-brand hover:underline"
                        href={`mailto:${job.metadata.contact_email}`}
                      >
                        <Mail className="h-4 w-4" />
                        {job.metadata.contact_name ||
                          job.metadata.contact_email}
                      </a>
                    </div>
                  </>
                ) : null}
              </div>
            </Card>

            <JobApplicationForm
              applicantEmail={applicantEmail}
              applicantName={applicantName}
              customQuestions={job.custom_questions ?? []}
              cvRequired={Boolean(job.metadata.cv_required)}
              isAuthenticated={isAuthenticated}
              jobId={job.$id}
            />

            <Card className="border-border/60 p-6 shadow-sm">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 text-brand" />
                <div className="space-y-2">
                  <h3 className="font-semibold text-foreground">
                    Applicant data
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    BISO stores your application data only for recruitment
                    handling and review.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
