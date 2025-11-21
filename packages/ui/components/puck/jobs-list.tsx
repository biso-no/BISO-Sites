"use client";

import { ArrowRight, Briefcase, Clock, DollarSign, MapPin } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";

export type JobItem = {
  title: string;
  department?: string;
  location?: string;
  type?: string; // Full-time, Part-time
  paid?: boolean;
  category?: string;
  description?: string;
  slug?: string;
  deadline?: string;
};

export type JobsListProps = {
  jobs: JobItem[];
  labels?: {
    viewDetails: string;
    paid: string;
    volunteer: string;
    deadline: string;
    noJobs: string;
  };
};

function JobsListContent({
  jobs = [],
  labels = {
    viewDetails: "View Details",
    paid: "Paid Position",
    volunteer: "Volunteer",
    deadline: "Deadline:",
    noJobs: "No positions found matching your criteria.",
  },
}: JobsListProps) {
  const searchParams = useSearchParams();
  const category = searchParams.get("category");
  const query = searchParams.get("q")?.toLowerCase();
  const paidOnly = searchParams.get("paid") === "true";

  const filteredJobs = jobs.filter((job) => {
    const matchesCategory =
      !category || category === "All" || job.category === category;
    const matchesSearch =
      !query ||
      job.title.toLowerCase().includes(query) ||
      job.department?.toLowerCase().includes(query) ||
      job.description?.toLowerCase().includes(query);
    const matchesPaid = !paidOnly || job.paid;

    return matchesCategory && matchesSearch && matchesPaid;
  });

  if (filteredJobs.length === 0) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        <Briefcase className="mx-auto mb-4 h-12 w-12 opacity-50" />
        <p>{labels.noJobs}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 py-8 md:grid-cols-2">
      <AnimatePresence mode="popLayout">
        {filteredJobs.map((job, index) => (
          <motion.div
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            initial={{ opacity: 0, scale: 0.95 }}
            key={index}
            layout
            transition={{ duration: 0.2 }}
          >
            <Card className="flex h-full flex-col border-l-4 border-l-[#3DA9E0] p-6 transition-shadow hover:shadow-lg">
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h3 className="mb-1 font-bold text-xl">{job.title}</h3>
                  <p className="font-medium text-muted-foreground text-sm uppercase tracking-wide">
                    {job.department}
                  </p>
                </div>
                {job.paid && (
                  <Badge
                    className="border-green-200 bg-green-100 text-green-700"
                    variant="secondary"
                  >
                    <DollarSign className="mr-1 h-3 w-3" />
                    {labels.paid}
                  </Badge>
                )}
              </div>

              <div className="mb-6 flex-1 space-y-3">
                {job.location && (
                  <div className="flex items-center text-muted-foreground text-sm">
                    <MapPin className="mr-2 h-4 w-4" />
                    {job.location}
                  </div>
                )}
                {job.type && (
                  <div className="flex items-center text-muted-foreground text-sm">
                    <Briefcase className="mr-2 h-4 w-4" />
                    {job.type}
                  </div>
                )}
                {job.deadline && (
                  <div className="flex items-center text-muted-foreground text-sm">
                    <Clock className="mr-2 h-4 w-4" />
                    {labels.deadline} {job.deadline}
                  </div>
                )}
                {job.description && (
                  <p className="mt-2 line-clamp-3 text-muted-foreground text-sm">
                    {job.description}
                  </p>
                )}
              </div>

              <div className="mt-auto border-t pt-4">
                <Button asChild className="w-full" variant="outline">
                  <Link href={`/jobs/${job.slug || "#"}`}>
                    {labels.viewDetails}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </Card>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function JobsList(props: JobsListProps) {
  return (
    <Suspense
      fallback={<div className="py-12 text-center">Loading jobs...</div>}
    >
      <JobsListContent {...props} />
    </Suspense>
  );
}
