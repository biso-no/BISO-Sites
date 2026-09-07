import type { RecruitmentVacancy } from "@repo/shared/types/recruitment";
import { PlateContentRenderer } from "@repo/ui/components/plate-content-renderer";
import { ArrowLeft, Mail, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { JobApplicationForm } from "@/components/jobs/job-application-form";
import { JobPostingSchema } from "@/components/jobs/job-posting-schema";
import { ledeFor } from "@/components/jobs/v2/lede";
import { CopyLinkButton } from "@/components/ui/copy-link-button";
import { PageHeader } from "@/components/ui/page-header";
import { Pill } from "@/components/ui/pill";
import { Prose } from "@/components/ui/prose";
import { Section } from "@/components/ui/section";

/**
 * The job detail page, rebuilt as a Server Component.
 *
 * v1 marks the whole 368-line view `"use client"` to get one copy-link button
 * and one back button. Here the button is a small island (`<CopyLinkButton>`),
 * the back button is a plain `<Link>` — which it always should have been, since
 * `router.push` inside a `<Button>` gives you no middle-click, no
 * open-in-new-tab and no visible href — and the rest renders on the server.
 * The application form is unchanged and still the only other client component.
 *
 * v1 also hardcodes every label in English ("Vacancy details", "Employer",
 * "Deadline", "Rolling") and formats dates `en-GB` regardless of locale, so a
 * Norwegian visitor reads an English page. Those are translated here.
 */
export interface JobDetailV2Props {
  applicantEmail?: string;
  applicantName?: string;
  isAuthenticated: boolean;
  job: RecruitmentVacancy;
  locale: string;
}

function SummaryRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="border-edge border-b py-3 last:border-b-0">
      <dt className="type-label text-ink-muted">{label}</dt>
      <dd className="type-body-sm mt-1 text-ink">{value}</dd>
    </div>
  );
}

async function VacancySummary({
  job,
  deadline,
}: {
  deadline: string;
  job: RecruitmentVacancy;
}) {
  const t = await getTranslations("jobs.detail");
  return (
    <div className="rounded-biso-md border border-edge p-6">
      <h2 className="type-heading-card text-ink">{t("summaryTitle")}</h2>
      <dl className="mt-3">
        <SummaryRow
          label={t("employer")}
          value={job.metadata.company || "BISO"}
        />
        {job.department?.Name ? (
          <SummaryRow label={t("department")} value={job.department.Name} />
        ) : null}
        <SummaryRow label={t("deadline")} value={deadline} />
        {job.metadata.location ? (
          <SummaryRow label={t("location")} value={job.metadata.location} />
        ) : null}
        {job.campus?.name ? (
          <SummaryRow label={t("campus")} value={job.campus.name} />
        ) : null}
        {job.metadata.contact_email ? (
          <SummaryRow
            label={t("contact")}
            value={
              <a
                className="inline-flex items-center gap-2 text-ink-accent underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                href={`mailto:${job.metadata.contact_email}`}
              >
                <Mail aria-hidden="true" className="h-4 w-4" />
                {job.metadata.contact_name || job.metadata.contact_email}
              </a>
            }
          />
        ) : null}
      </dl>
    </div>
  );
}

export async function JobDetailV2({
  applicantEmail,
  applicantName,
  isAuthenticated,
  job,
  locale,
}: JobDetailV2Props) {
  const [t, tCommon, tNav] = await Promise.all([
    getTranslations("jobs"),
    getTranslations("common"),
    getTranslations("common.navigation"),
  ]);

  const intlLocale = locale === "no" ? "nb-NO" : "en-GB";
  const translation = job.translations[0];
  const title = translation?.title ?? "";
  const description = translation?.description ?? "";
  const deadline = job.application_deadline
    ? new Date(job.application_deadline).toLocaleDateString(intlLocale)
    : t("detail.rolling");
  const hasCommitment = Boolean(
    job.metadata.commitment || job.metadata.term || job.metadata.start_date
  );

  return (
    <>
      <JobPostingSchema job={job} />
      <PageHeader
        actions={
          <CopyLinkButton
            copiedLabel={t("detail.copied")}
            copyLabel={t("detail.copyLink")}
          />
        }
        breadcrumbs={[
          { label: tCommon("breadcrumbs.home"), href: "/" },
          { label: tNav("links.jobs"), href: "/jobs" },
          { label: title },
        ]}
        lede={ledeFor(translation?.short_description, description)}
        meta={
          <>
            {job.metadata.employment_type ? (
              <Pill tone="accent" uppercase>
                {job.metadata.employment_type}
              </Pill>
            ) : null}
            {job.metadata.paid ? (
              <Pill tone="success">{t("card.paid")}</Pill>
            ) : null}
          </>
        }
        title={title}
      />

      <Section tone="paper">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0 space-y-10">
            <div>
              <h2 className="type-heading-section text-ink">
                {t("detail.about")}
              </h2>
              <Prose className="mt-5">
                <PlateContentRenderer value={description || null} />
              </Prose>
            </div>

            {hasCommitment ? (
              <div>
                <h2 className="type-heading-card text-ink">
                  {t("detail.commitmentTitle")}
                </h2>
                <dl className="mt-4 grid gap-x-8 sm:grid-cols-3">
                  {job.metadata.commitment ? (
                    <SummaryRow
                      label={t("detail.hours")}
                      value={job.metadata.commitment}
                    />
                  ) : null}
                  {job.metadata.term ? (
                    <SummaryRow
                      label={t("detail.term")}
                      value={job.metadata.term}
                    />
                  ) : null}
                  {job.metadata.start_date ? (
                    <SummaryRow
                      label={t("detail.startDate")}
                      value={new Date(
                        job.metadata.start_date
                      ).toLocaleDateString(intlLocale)}
                    />
                  ) : null}
                </dl>
              </div>
            ) : null}
          </div>

          {/* The sidebar is source-ordered after the description: on mobile the
              reader gets the role before the form, and a keyboard user reaches
              the apply form having already passed what they are applying to. */}
          <div className="space-y-8">
            <VacancySummary deadline={deadline} job={job} />

            <JobApplicationForm
              applicantEmail={applicantEmail}
              applicantName={applicantName}
              customQuestions={job.custom_questions ?? []}
              cvRequired={Boolean(job.metadata.cv_required)}
              isAuthenticated={isAuthenticated}
              jobId={job.$id}
            />

            <div className="flex items-start gap-3 rounded-biso-md bg-surface-sunken p-5">
              <ShieldCheck
                aria-hidden="true"
                className="mt-0.5 h-5 w-5 shrink-0 text-ink-accent"
              />
              <div>
                <h2 className="type-label text-ink">{t("detail.gdprTitle")}</h2>
                <p className="type-body-sm mt-1 text-ink-muted">
                  {t("detail.gdprBody")}
                </p>
              </div>
            </div>

            <Link
              className="inline-flex items-center gap-2 text-ink-accent underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              href="/jobs"
            >
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />
              <span className="type-label">{t("detail.back")}</span>
            </Link>
          </div>
        </div>
      </Section>
    </>
  );
}
