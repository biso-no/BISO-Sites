import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getJobBySlug } from "@/app/actions/jobs";
import { getLocale } from "@/app/actions/locale";
import { JobDetailsClient } from "@/components/jobs/job-details-client";

type JobPageProps = {
  params: {
    slug: string;
  };
};

async function JobDetails({ slug }: { slug: string }) {
  const locale = await getLocale();

  // Fetch the job
  const job = await getJobBySlug(slug, locale);

  if (!job) {
    notFound();
  }

  return <JobDetailsClient job={job} />;
}

function JobDetailsSkeleton() {
  return (
    <div className="min-h-screen bg-linear-to-b from-gray-50 to-white">
      <div className="relative h-[40vh]">
        <Skeleton className="h-full w-full" />
      </div>
      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="space-y-8 lg:col-span-2">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function JobPage({ params }: JobPageProps) {
  return (
    <Suspense fallback={<JobDetailsSkeleton />}>
      <JobDetails slug={params.slug} />
    </Suspense>
  );
}

// Generate metadata for SEO
export async function generateMetadata({ params }: JobPageProps) {
  const locale = await getLocale();
  const job = await getJobBySlug(params.slug, locale);

  if (!job) {
    return {
      title: "Position Not Found | BISO",
    };
  }

  return {
    title: `${job.title} | BISO Careers`,
    description: job.description,
  };
}
