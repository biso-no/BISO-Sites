"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Newspaper } from "lucide-react";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";

export function NoResults() {
  const router = useRouter();

  const clearFilters = () => {
    router.push("/news");
  };

  return (
    <motion.div
      animate={{ opacity: 1 }}
      className="py-20 text-center"
      initial={{ opacity: 0 }}
    >
      <Newspaper className="mx-auto mb-4 h-16 w-16 text-gray-300" />
      <h3 className="mb-2 font-bold text-2xl text-gray-900">
        No articles found
      </h3>
      <p className="mb-6 text-gray-600">
        Try adjusting your filters or search query
      </p>
      <Button
        className="border-[#3DA9E0] text-[#001731] hover:bg-[#3DA9E0]/10"
        onClick={clearFilters}
        variant="outline"
      >
        Clear Filters
      </Button>
    </motion.div>
  );
}
