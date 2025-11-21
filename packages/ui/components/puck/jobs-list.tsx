"use client";

import { ArrowRight, Briefcase, Clock, DollarSign, MapPin } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import React, { Suspense } from "react";
import { cn } from "../../lib/utils";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";

export interface JobItem {
  title: string;
  department?: string;
  location?: string;
  type?: string; // Full-time, Part-time
  paid?: boolean;
  category?: string;
  description?: string;
  slug?: string;
  deadline?: string;
}

export interface JobsListProps {
  jobs: JobItem[];
  labels?: {
    viewDetails: string;
    paid: string;
    volunteer: string;
    deadline: string;
    noJobs: string;
  };
}

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
      job.description?.toLowerCase().includes(query) ||
      false;
    const matchesPaid = !paidOnly || job.paid;

    return matchesCategory && matchesSearch && matchesPaid;
  });

  if (filteredJobs.length === 0) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        <Briefcase className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>{labels.noJobs}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 py-8">
      <AnimatePresence mode="popLayout">
        {filteredJobs.map((job, index) => (
          <motion.div
            key={index}
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            <Card className="h-full p-6 flex flex-col hover:shadow-lg transition-shadow border-l-4 border-l-[#3DA9E0]">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-xl mb-1">{job.title}</h3>
                  <p className="text-sm text-muted-foreground font-medium uppercase tracking-wide">
                    {job.department}
                  </p>
                </div>
                {job.paid && (
                  <Badge
                    variant="secondary"
                    className="bg-green-100 text-green-700 border-green-200"
                  >
                    <DollarSign className="w-3 h-3 mr-1" />
                    {labels.paid}
                  </Badge>
                )}
              </div>

              <div className="space-y-3 mb-6 flex-1">
                {job.location && (
                  <div className="flex items-center text-sm text-muted-foreground">
                    <MapPin className="w-4 h-4 mr-2" />
                    {job.location}
                  </div>
                )}
                {job.type && (
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Briefcase className="w-4 h-4 mr-2" />
                    {job.type}
                  </div>
                )}
                {job.deadline && (
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Clock className="w-4 h-4 mr-2" />
                    {labels.deadline} {job.deadline}
                  </div>
                )}
                {job.description && (
                  <p className="text-sm text-muted-foreground line-clamp-3 mt-2">
                    {job.description}
                  </p>
                )}
              </div>

              <div className="mt-auto pt-4 border-t">
                <Button asChild className="w-full" variant="outline">
                  <Link href={`/jobs/${job.slug || "#"}`}>
                    {labels.viewDetails}
                    <ArrowRight className="w-4 h-4 ml-2" />
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
