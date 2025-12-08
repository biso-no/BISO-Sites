import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { BookOpen, Cog, PartyPopper, Rocket } from "lucide-react";
import { Suspense } from "react";
import { listJobs } from "@/app/actions/jobs";
import { getLocale } from "@/app/actions/locale";
import { JobsHero } from "@/components/jobs/jobs-hero";
import { JobsListClient } from "@/components/jobs/jobs-list-client";

const jobCategories = [
 {
 name: "Academic Associations",
 icon: BookOpen,
 color: "from-blue-500 to-indigo-600",
 },
 { name: "Societies", icon: PartyPopper, color: "from-brand-gradient-from to-cyan-500" },
 { name: "Staff Functions", icon: Cog, color: "from-brand-gradient-to to-slate-700" },
 { name: "Projects", icon: Rocket, color: "from-purple-500 to-pink-500" },
];

// This is a server component
export const metadata = {
 title: "Join Our Team | BISO",
 description: "Discover open positions at BISO and join our team",
};

async function JobsList({ locale }: { locale: "en" | "no" }) {
 // Fetch jobs on the server
 const jobs = await listJobs({
 locale,
 status: "published",
 limit: 100,
 });

 // Calculate stats for hero
 const paidPositions = jobs.filter((job) => {
 const jobMetadata = job.job_ref?.metadata as Record<string, any>;
 return jobMetadata.paid === true;
 }).length;

 const departmentCount =
 new Set(jobs.map((job) => job.job_ref?.department_id).filter(Boolean))
 .size || jobCategories.length;

 return (
 <>
 <JobsHero
 departmentCount={departmentCount}
 paidPositions={paidPositions}
 totalPositions={jobs.length}
 />
 <JobsListClient jobs={jobs} />
 </>
 );
}

function JobsListSkeleton() {
 return (
 <>
 <div className="relative h-[60vh]">
 <Skeleton className="h-full w-full" />
 </div>
 <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
 <div className="grid gap-8 md:grid-cols-2">
 {[...new Array(6)].map((_, i) => (
 <div className="space-y-4" key={i}>
 <Skeleton className="h-48 w-full" />
 <Skeleton className="h-6 w-3/4" />
 <Skeleton className="h-4 w-full" />
 <Skeleton className="h-4 w-full" />
 <Skeleton className="h-10 w-full" />
 </div>
 ))}
 </div>
 </div>
 </>
 );
}

export default async function JobsPage() {
 const locale = await getLocale();

 return (
 <div className="min-h-screen bg-linear-to-b from-section to-background">
 <Suspense fallback={<JobsListSkeleton />}>
 <JobsList locale={locale} />
 </Suspense>
 </div>
 );
}
