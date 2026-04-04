"use client";

import { Card } from "@repo/ui/components/ui/card";
import { TabsContent } from "@repo/ui/components/ui/tabs";
import { Award, Briefcase, Calendar } from "lucide-react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";

export function OpportunitiesTab() {
  const _t = useTranslations("memberPortal.opportunities"); // Assuming we have or will add this

  return (
    <TabsContent className="space-y-8" value="opportunities">
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
        initial={{ opacity: 0, y: 20 }}
      >
        <h2 className="mb-4 font-bold text-3xl text-foreground dark:text-foreground">
          Opportunities & Growth
        </h2>
        <p className="mx-auto max-w-2xl text-muted-foreground dark:text-muted-foreground">
          Boost your career and social life with exclusive BISO member
          opportunities.
        </p>
      </motion.div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="border-0 bg-section p-6 shadow-lg dark:bg-inverted">
          <Briefcase className="mb-4 h-8 w-8 text-brand" />
          <h3 className="mb-2 font-bold text-xl">Career Portal</h3>
          <p className="text-muted-foreground text-sm">
            Find job listings, internships, and networking events aimed at BI
            students.
          </p>
        </Card>

        <Card className="border-0 bg-section p-6 shadow-lg dark:bg-inverted">
          <Calendar className="mb-4 h-8 w-8 text-brand" />
          <h3 className="mb-2 font-bold text-xl">Social Events</h3>
          <p className="text-muted-foreground text-sm">
            Join social gatherings, parties, and networking sessions arranged by
            BISO.
          </p>
        </Card>

        <Card className="border-0 bg-section p-6 shadow-lg dark:bg-inverted">
          <Award className="mb-4 h-8 w-8 text-brand" />
          <h3 className="mb-2 font-bold text-xl">Skill Development</h3>
          <p className="text-muted-foreground text-sm">
            Participate in workshops and courses to build your resume and
            skills.
          </p>
        </Card>
      </div>
    </TabsContent>
  );
}
