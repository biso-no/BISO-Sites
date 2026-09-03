import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getJobBySlug } from "@/app/actions/jobs";
import { getLocale } from "@/app/actions/locale";
import { JobDetailV2 } from "@/components/jobs/v2/job-detail-v2";
import { DetailSkeleton } from "@/components/ui/loading-shell";
import { getLoggedInUser } from "@/lib/actions/user";

interface JobPageProps {
  params: Promise<{ slug: string }>;
}

// Both generateMetadata and the page component call getJobBySlug — React cache()
// inside the action deduplicates these to a single Appwrite request per render.

async function JobDetails({ slug }: { slug: string }) {
  const [locale, user] = await Promise.all([getLocale(), getLoggedInUser()]);
  const job = await getJobBySlug(slug, locale);

  if (!job) {
    notFound();
  }

  return (
    <JobDetailV2
      applicantEmail={user?.user.email ?? ""}
      applicantName={user?.user.name ?? ""}
      isAuthenticated={Boolean(user)}
      job={job}
      locale={locale}
    />
  );
}

export default async function JobPage({ params }: JobPageProps) {
  const { slug } = await params;
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <JobDetails slug={slug} />
    </Suspense>
  );
}

export async function generateMetadata({ params }: JobPageProps) {
  const { slug } = await params;
  const locale = await getLocale();
  const job = await getJobBySlug(slug, locale);

  if (!job) {
    return { title: "Position Not Found | BISO" };
  }

  const translation = job.translations[0];
  const title = translation?.title ?? "Position";
  const description =
    translation?.short_description ??
    job.metadata.short_description ??
    translation?.description?.slice(0, 160) ??
    "";
  const campus = job.campus?.name ? ` · ${job.campus.name}` : "";

  return {
    title: `${title} | BISO Careers`,
    description: `${description}${campus}`.trim(),
    openGraph: {
      title: `${title} | BISO Careers`,
      description,
      type: "website",
    },
  };
}
