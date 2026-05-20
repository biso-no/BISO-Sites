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
  Copy,
  Mail,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { JobApplicationForm } from "./job-application-form";

interface JobDetailsClientProps {
  applicantEmail?: string;
  applicantName?: string;
  isAuthenticated: boolean;
  job: RecruitmentVacancy;
}

function JobPostingSchema({ job }: { job: RecruitmentVacancy }) {
  const translation = job.translations[0];
  const title = translation?.title ?? "Untitled";
  const description =
    job.metadata.short_description ??
    translation?.short_description ??
    translation?.description ??
    "";

  const schema = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title,
    description,
    datePosted: job.$createdAt,
    ...(job.metadata.application_deadline
      ? { validThrough: job.metadata.application_deadline }
      : {}),
    hiringOrganization: {
      "@type": "Organization",
      name: job.metadata.company ?? "BISO",
    },
    ...(job.metadata.location
      ? {
          jobLocation: {
            "@type": "Place",
            name: job.metadata.location,
          },
        }
      : {}),
    ...(job.metadata.employment_type
      ? { employmentType: job.metadata.employment_type.toUpperCase() }
      : {}),
    ...(job.metadata.paid === true
      ? { baseSalary: { "@type": "MonetaryAmount", currency: "NOK" } }
      : {}),
    identifier: {
      "@type": "PropertyValue",
      name: "BISO",
      value: job.$id,
    },
  };

  return (
    <script
      // biome-ignore lint/security/noDangerouslySetInnerHtml: structured data only
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      type="application/ld+json"
    />
  );
}

export function JobDetailsClient({
  applicantEmail,
  applicantName,
  isAuthenticated,
  job,
}: JobDetailsClientProps) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  const translation = job.translations[0];
  const title = translation?.title ?? "Untitled";
  const description = translation?.description ?? "";
  const deadline = job.metadata.application_deadline
    ? new Date(job.metadata.application_deadline).toLocaleDateString("en-GB")
    : "Rolling";
  const department = job.department?.Name || "BISO";
  const company = job.metadata.company || "BISO";
  const employmentType = job.metadata.employment_type || "Position";

  function copyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-section to-background">
      <JobPostingSchema job={job} />

      {/* Hero header */}
      <section className="border-border/60 border-b bg-linear-to-br from-brand-gradient-from/10 to-brand-gradient-to/10">
        <div className="mx-auto max-w-6xl px-4 py-16">
          {/* Breadcrumb + actions */}
          <div className="mb-6 flex items-center justify-between">
            <nav aria-label="Breadcrumb">
              <ol className="flex items-center gap-2 text-muted-foreground text-sm">
                <li>
                  <Link className="hover:text-foreground" href="/jobs">
                    Vacancies
                  </Link>
                </li>
                <li aria-hidden>/</li>
                <li className="text-foreground">{title}</li>
              </ol>
            </nav>
            <Button
              className="gap-2 text-muted-foreground"
              onClick={copyLink}
              size="sm"
              variant="ghost"
            >
              <Copy className="h-4 w-4" />
              {copied ? "Copied!" : "Share"}
            </Button>
          </div>

          <div className="max-w-3xl space-y-4">
            <Badge variant="outline">{employmentType}</Badge>
            <h1 className="font-semibold text-4xl text-foreground md:text-5xl">
              {title}
            </h1>
            <p className="text-lg text-muted-foreground">
              {company} · {department}
            </p>
            <div className="flex flex-wrap gap-3 text-muted-foreground text-sm">
              {job.metadata.location && (
                <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-4 py-2">
                  <MapPin className="h-4 w-4" />
                  {job.metadata.location}
                </span>
              )}
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

      {/* Main content */}
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Left: description */}
          <div className="space-y-8 lg:col-span-2">
            <Card className="border-border/60 p-8 shadow-sm">
              <h2 className="font-semibold text-2xl text-foreground">
                About this vacancy
              </h2>
              <PlateContentRenderer
                className="mt-6 text-muted-foreground"
                value={description || null}
              />
            </Card>

            {job.metadata.commitment || job.metadata.term || job.metadata.start_date ? (
              <Card className="border-border/60 p-8 shadow-sm">
                <h2 className="font-semibold text-xl text-foreground">
                  Commitment
                </h2>
                <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
                  {job.metadata.commitment && (
                    <div>
                      <dt className="text-muted-foreground">Hours</dt>
                      <dd className="font-medium text-foreground">{job.metadata.commitment}</dd>
                    </div>
                  )}
                  {job.metadata.term && (
                    <div>
                      <dt className="text-muted-foreground">Term</dt>
                      <dd className="font-medium text-foreground">{job.metadata.term}</dd>
                    </div>
                  )}
                  {job.metadata.start_date && (
                    <div>
                      <dt className="text-muted-foreground">Start date</dt>
                      <dd className="font-medium text-foreground">
                        {new Date(job.metadata.start_date).toLocaleDateString("en-GB")}
                      </dd>
                    </div>
                  )}
                </dl>
              </Card>
            ) : null}
          </div>

          {/* Right: sidebar */}
          <div className="space-y-6">
            {/* Vacancy details */}
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
                {job.metadata.location && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-muted-foreground">Location</p>
                      <p className="font-medium text-foreground">
                        {job.metadata.location}
                      </p>
                    </div>
                  </>
                )}
                {job.campus?.name && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-muted-foreground">Campus</p>
                      <p className="font-medium text-foreground">{job.campus.name}</p>
                    </div>
                  </>
                )}
                {job.metadata.contact_email && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-muted-foreground">Contact</p>
                      <a
                        className="inline-flex items-center gap-2 font-medium text-brand hover:underline"
                        href={`mailto:${job.metadata.contact_email}`}
                        rel="noopener noreferrer"
                      >
                        <Mail className="h-4 w-4" />
                        {job.metadata.contact_name || job.metadata.contact_email}
                      </a>
                    </div>
                  </>
                )}
              </div>
            </Card>

            {/* Application form */}
            <JobApplicationForm
              applicantEmail={applicantEmail}
              applicantName={applicantName}
              customQuestions={job.custom_questions ?? []}
              cvRequired={Boolean(job.metadata.cv_required)}
              isAuthenticated={isAuthenticated}
              jobId={job.$id}
            />

            {/* GDPR notice */}
            <Card className="border-border/60 p-6 shadow-sm">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 text-brand" />
                <div className="space-y-1">
                  <h3 className="font-semibold text-foreground text-sm">
                    Your data
                  </h3>
                  <p className="text-muted-foreground text-xs">
                    BISO stores your application data solely for this recruitment
                    process and deletes it after 180 days.
                  </p>
                </div>
              </div>
            </Card>

            {/* Back link */}
            <Button
              className="w-full gap-2"
              onClick={() => router.push("/jobs")}
              variant="outline"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to all vacancies
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
