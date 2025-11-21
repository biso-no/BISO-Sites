"use client";

import type { ContentTranslations } from "@repo/api/types/appwrite";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import {
  BookOpen,
  Briefcase,
  Cog,
  DollarSign,
  Filter,
  PartyPopper,
  Rocket,
  Search,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { JobCard } from "./job-card";

type JobsListClientProps = {
  jobs: ContentTranslations[];
};

const getJobCategory = (metadata: Record<string, any>) =>
  metadata.category || "General";

const _parseJobMetadata = (metadata: Record<string, any>) => metadata || {};

const categories = [
  { name: "All", icon: Briefcase, color: "from-[#3DA9E0] to-[#001731]" },
  {
    name: "Academic Associations",
    icon: BookOpen,
    color: "from-blue-500 to-indigo-600",
  },
  { name: "Societies", icon: PartyPopper, color: "from-[#3DA9E0] to-cyan-500" },
  { name: "Staff Functions", icon: Cog, color: "from-[#001731] to-slate-700" },
  { name: "Projects", icon: Rocket, color: "from-purple-500 to-pink-500" },
];

export function JobsListClient({ jobs }: JobsListClientProps) {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [showPaidOnly, setShowPaidOnly] = useState(false);

  // Filter jobs based on search, category, and paid status
  const filteredJobs = jobs.filter((job) => {
    const jobData = job.job_ref;
    const metadata = jobData?.metadata as Record<string, any>;
    const category = getJobCategory(metadata);
    const paid = metadata.paid ?? false;
    const department = jobData?.department?.Name || "";

    const matchesCategory =
      selectedCategory === "All" || category === selectedCategory;
    const matchesSearch =
      job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (job.short_description || "")
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      department.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPaid = !showPaidOnly || paid;

    return matchesCategory && matchesSearch && matchesPaid;
  });

  const handleViewDetails = (job: ContentTranslations) => {
    // Use slug if available, otherwise fall back to content_id
    const slug = job.job_ref?.slug || job.content_id;
    router.push(`/jobs/${slug}`);
  };

  return (
    <>
      {/* Filters & Search */}
      <div className="sticky top-20 z-40 border-gray-100 border-b bg-white/95 shadow-lg backdrop-blur-lg">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4">
            {/* Search */}
            <div className="relative w-full">
              <Search className="-translate-y-1/2 absolute top-1/2 left-3 h-5 w-5 text-gray-400" />
              <Input
                className="w-full border-[#3DA9E0]/20 pr-10 pl-10 focus:border-[#3DA9E0]"
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search positions by title, department, or description..."
                type="text"
                value={searchQuery}
              />
              {searchQuery && (
                <button
                  className="-translate-y-1/2 absolute top-1/2 right-3 text-gray-400 hover:text-gray-600"
                  onClick={() => setSearchQuery("")}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Category Filter */}
            <div className="flex flex-wrap items-center gap-3">
              <Filter className="h-5 w-5 text-[#001731]" />
              {categories.map((category) => {
                const Icon = category.icon;
                return (
                  <Button
                    className={
                      selectedCategory === category.name
                        ? `bg-linear-to-r ${category.color} border-0 text-white`
                        : "border-[#3DA9E0]/20 text-[#001731] hover:bg-[#3DA9E0]/10"
                    }
                    key={category.name}
                    onClick={() => setSelectedCategory(category.name)}
                    variant={
                      selectedCategory === category.name ? "default" : "outline"
                    }
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    {category.name}
                  </Button>
                );
              })}

              {/* Paid Filter */}
              <div className="ml-auto flex items-center gap-2">
                <Button
                  className={
                    showPaidOnly
                      ? "border-0 bg-linear-to-r from-green-500 to-emerald-600 text-white"
                      : "border-green-500/20 text-green-700 hover:bg-green-50"
                  }
                  onClick={() => setShowPaidOnly(!showPaidOnly)}
                  variant={showPaidOnly ? "default" : "outline"}
                >
                  <DollarSign className="mr-2 h-4 w-4" />
                  Paid Positions Only
                </Button>
              </div>
            </div>

            <div className="text-center text-gray-600 text-sm">
              Showing {filteredJobs.length}{" "}
              {filteredJobs.length === 1 ? "position" : "positions"}
            </div>
          </div>
        </div>
      </div>

      {/* Positions Grid */}
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <AnimatePresence mode="wait">
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="grid gap-8 md:grid-cols-2"
            exit={{ opacity: 0, y: -20 }}
            initial={{ opacity: 0, y: 20 }}
            key={selectedCategory + searchQuery + showPaidOnly}
          >
            {filteredJobs.map((job, index) => (
              <JobCard
                index={index}
                job={job}
                key={job.$id}
                onViewDetails={handleViewDetails}
              />
            ))}
          </motion.div>
        </AnimatePresence>

        {/* No Results */}
        {filteredJobs.length === 0 && (
          <motion.div
            animate={{ opacity: 1 }}
            className="py-20 text-center"
            initial={{ opacity: 0 }}
          >
            <Briefcase className="mx-auto mb-4 h-16 w-16 text-gray-300" />
            <h3 className="mb-2 font-bold text-2xl text-gray-900">
              No positions found
            </h3>
            <p className="mb-6 text-gray-600">
              Try adjusting your filters or search query
            </p>
            <Button
              className="border-[#3DA9E0] text-[#001731] hover:bg-[#3DA9E0]/10"
              onClick={() => {
                setSelectedCategory("All");
                setSearchQuery("");
                setShowPaidOnly(false);
              }}
              variant="outline"
            >
              Clear All Filters
            </Button>
          </motion.div>
        )}
      </div>

      {/* CTA Section */}
      <div className="bg-linear-to-r from-[#001731] to-[#3DA9E0] py-16">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <h2 className="mb-4 font-bold text-3xl text-white">
            Questions About Applying?
          </h2>
          <p className="mb-8 text-lg text-white/90">
            Our recruitment team is here to help! Reach out if you have any
            questions about positions or the application process.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button className="bg-white text-[#001731] hover:bg-white/90">
              Contact Recruitment Team
            </Button>
            <Button
              className="border-white text-white hover:bg-white/10"
              variant="outline"
            >
              Download Information Pack
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
