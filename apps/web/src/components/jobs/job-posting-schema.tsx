import type { RecruitmentVacancy } from "@repo/shared/types/recruitment";
import { serializeJsonLd } from "@/lib/json-ld";

/**
 * `JobPosting` structured data — what puts a BISO vacancy into Google Jobs.
 *
 * Extracted from `job-details-client` in RD-019 so the redesigned server-
 * rendered detail page emits byte-identical markup. It carries no "use client"
 * directive: it is a plain `<script>` tag and both the v1 client view and the
 * v2 server view render it.
 */

function mapEmploymentType(
  type: string | undefined | null
): string | undefined {
  if (!type) {
    return undefined;
  }
  const t = type.toLowerCase();
  if (
    t.includes("full time") ||
    t.includes("full-time") ||
    t.includes("full_time") ||
    t.includes("100%")
  ) {
    return "FULL_TIME";
  }
  if (
    t.includes("part time") ||
    t.includes("part-time") ||
    t.includes("part_time") ||
    t.includes("deltid")
  ) {
    return "PART_TIME";
  }
  if (t.includes("intern")) {
    return "INTERN";
  }
  if (t.includes("volunteer") || t.includes("frivillig")) {
    return "VOLUNTEER";
  }
  if (t.includes("contract")) {
    return "CONTRACTOR";
  }
  if (t.includes("temporary") || t.includes("temp")) {
    return "TEMPORARY";
  }
  return "OTHER";
}

export function JobPostingSchema({ job }: { job: RecruitmentVacancy }) {
  const translation = job.translations[0];
  const title = translation?.title ?? "Untitled";
  const description =
    translation?.short_description ??
    job.metadata.short_description ??
    translation?.description ??
    "";

  const schema = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title,
    description,
    datePosted: job.$createdAt,
    ...(job.application_deadline
      ? { validThrough: job.application_deadline }
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
    ...(mapEmploymentType(job.metadata.employment_type)
      ? { employmentType: mapEmploymentType(job.metadata.employment_type) }
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
      // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD payload, HTML-escaped by serializeJsonLd.
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(schema) }}
      type="application/ld+json"
    />
  );
}
