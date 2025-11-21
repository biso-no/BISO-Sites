import type { CampusMetadata } from "@repo/api/types/appwrite";
import { Card } from "@repo/ui/components/ui/card";
import { Award } from "lucide-react";
import { motion } from "motion/react";
import type { Locale } from "@/i18n/config";

type FocusAreasProps = {
  campusMetadata: CampusMetadata | null;
  locale: Locale;
};

export function FocusAreas({ campusMetadata, locale }: FocusAreasProps) {
  const focusAreas = campusMetadata
    ? (locale === "en"
        ? campusMetadata.focusAreas_en
        : campusMetadata.focusAreas_nb) ||
      campusMetadata.focusAreas_en ||
      campusMetadata.focusAreas_nb ||
      []
    : [];

  if (!focusAreas || focusAreas.length === 0) {
    return null;
  }

  return (
    <section>
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 text-center"
        initial={{ opacity: 0, y: 20 }}
      >
        <h2 className="mb-4 text-gray-900">
          {locale === "en" ? "Our Focus Areas" : "Våre fokusområder"}
        </h2>
        <p className="mx-auto max-w-2xl text-gray-600">
          {locale === "en"
            ? "We're dedicated to creating exceptional experiences across these key areas"
            : "Vi er dedikerte til å skape eksepsjonelle opplevelser innenfor disse nøkkelområdene"}
        </p>
      </motion.div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {focusAreas.map((area, index) => (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            initial={{ opacity: 0, y: 20 }}
            key={index}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="cursor-pointer border-0 bg-linear-to-br from-white to-[#3DA9E0]/5 p-6 shadow-lg transition-all hover:scale-105 hover:shadow-xl">
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-linear-to-br from-[#3DA9E0] to-[#001731]">
                  <Award className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-gray-900">{area}</h3>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
