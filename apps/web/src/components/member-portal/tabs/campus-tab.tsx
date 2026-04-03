"use client";

import { Card } from "@repo/ui/components/ui/card";
import { TabsContent } from "@repo/ui/components/ui/tabs";
import { MapPin, Users, BookOpen } from "lucide-react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";

export function CampusTab() {
  const t = useTranslations("memberPortal.campus"); // Assuming we have or will add this

  return (
    <TabsContent className="space-y-8" value="campus">
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        initial={{ opacity: 0, y: 20 }}
        className="text-center"
      >
        <h2 className="mb-4 font-bold text-3xl text-foreground dark:text-foreground">
          Your Campus Hub
        </h2>
        <p className="mx-auto max-w-2xl text-muted-foreground dark:text-muted-foreground">
          Discover resources, perks, and local management details specific to
          your campus.
        </p>
      </motion.div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="p-6 border-0 shadow-lg bg-section dark:bg-inverted">
          <BookOpen className="h-8 w-8 text-brand mb-4" />
          <h3 className="font-bold text-xl mb-2">Local Resources</h3>
          <p className="text-muted-foreground text-sm">
            Access study rooms, campus maps, and facility information dedicated
            to BISO members.
          </p>
        </Card>

        <Card className="p-6 border-0 shadow-lg bg-section dark:bg-inverted">
          <Users className="h-8 w-8 text-brand mb-4" />
          <h3 className="font-bold text-xl mb-2">Campus Management</h3>
          <p className="text-muted-foreground text-sm">
            Connect with your local BISO representatives and student groups.
          </p>
        </Card>

        <Card className="p-6 border-0 shadow-lg bg-section dark:bg-inverted">
          <MapPin className="h-8 w-8 text-brand mb-4" />
          <h3 className="font-bold text-xl mb-2">Campus Events</h3>
          <p className="text-muted-foreground text-sm">
            Stay updated with the latest events happening right on your campus.
          </p>
        </Card>
      </div>
    </TabsContent>
  );
}
