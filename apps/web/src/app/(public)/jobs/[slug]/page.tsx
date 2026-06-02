import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getJobBySlug } from "@/app/actions/jobs";
import { getLocale } from "@/app/actions/locale";
import { JobDetailsClient } from "@/components/jobs/job-details-client";
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
    <JobDetailsClient
      applicantEmail={user?.user.email ?? ""}
      applicantName={user?.user.name ?? ""}
      isAuthenticated={Boolean(user)}
      job={job}
    />
  );
}

function JobDetailsSkeleton() {
  return (
    <div className="min-h-screen bg-linear-to-b from-section to-background">
      <div className="relative h-[40vh]">
        <Skeleton className="h-full w-full" />
      </div>
      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="space-y-8 lg:col-span-2">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function JobPage({ params }: JobPageProps) {
  const { slug } = await params;
  return (
    <Suspense fallback={<JobDetailsSkeleton />}>
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

export function generateStaticParams() {
  // Statically generate known open vacancies at build time; ISR handles new ones.
  return [];
}
