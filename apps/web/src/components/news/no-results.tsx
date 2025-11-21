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
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="text-center py-20"
    >
      <Newspaper className="w-16 h-16 text-gray-300 mx-auto mb-4" />
      <h3 className="text-2xl font-bold mb-2 text-gray-900">
        No articles found
      </h3>
      <p className="text-gray-600 mb-6">
        Try adjusting your filters or search query
      </p>
      <Button
        onClick={clearFilters}
        variant="outline"
        className="border-[#3DA9E0] text-[#001731] hover:bg-[#3DA9E0]/10"
      >
        Clear Filters
      </Button>
    </motion.div>
  );
}
