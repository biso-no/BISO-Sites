"use client";

import { Card } from "@repo/ui/components/ui/card";
import { TabsContent } from "@repo/ui/components/ui/tabs";
import { BookOpen, MapPin, Users } from "lucide-react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";

export function CampusTab() {
  const t = useTranslations("memberPortal.campus");

  return (
    <TabsContent className="space-y-8" value="campus">
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
        initial={{ opacity: 0, y: 20 }}
      >
        <h2 className="mb-4 font-bold text-3xl text-foreground dark:text-foreground">
          {t("title")}
        </h2>
        <p className="mx-auto max-w-2xl text-muted-foreground dark:text-muted-foreground">
          {t("description")}
        </p>
      </motion.div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="border-0 bg-section p-6 shadow-lg dark:bg-inverted">
          <BookOpen className="mb-4 h-8 w-8 text-brand" />
          <h3 className="mb-2 font-bold text-xl">{t("localResources.title")}</h3>
          <p className="text-muted-foreground text-sm">
            {t("localResources.description")}
          </p>
        </Card>

        <Card className="border-0 bg-section p-6 shadow-lg dark:bg-inverted">
          <Users className="mb-4 h-8 w-8 text-brand" />
          <h3 className="mb-2 font-bold text-xl">{t("campusManagement.title")}</h3>
          <p className="text-muted-foreground text-sm">
            {t("campusManagement.description")}
          </p>
        </Card>

        <Card className="border-0 bg-section p-6 shadow-lg dark:bg-inverted">
          <MapPin className="mb-4 h-8 w-8 text-brand" />
          <h3 className="mb-2 font-bold text-xl">{t("campusEvents.title")}</h3>
          <p className="text-muted-foreground text-sm">
            {t("campusEvents.description")}
          </p>
        </Card>
      </div>
    </TabsContent>
  );
}
