import type { CampusMetadata } from "@repo/api/types/appwrite";
import { Card } from "@repo/ui/components/ui/card";
import { Award } from "lucide-react";
import { motion } from "motion/react";
import type { Locale } from "@/i18n/config";

interface FocusAreasProps {
  campusMetadata: CampusMetadata | null;
  locale: Locale;
}

export function FocusAreas({ campusMetadata, locale }: FocusAreasProps) {
  const focusAreas = campusMetadata
    ? (locale === "en" ? campusMetadata.focusAreas_en : campusMetadata.focusAreas_nb) ||
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
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <h2 className="text-gray-900 mb-4">
          {locale === "en" ? "Our Focus Areas" : "Våre fokusområder"}
        </h2>
        <p className="text-gray-600 max-w-2xl mx-auto">
          {locale === "en"
            ? "We're dedicated to creating exceptional experiences across these key areas"
            : "Vi er dedikerte til å skape eksepsjonelle opplevelser innenfor disse nøkkelområdene"}
        </p>
      </motion.div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {focusAreas.map((area, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="p-6 border-0 shadow-lg hover:shadow-xl transition-all hover:scale-105 cursor-pointer bg-linear-to-br from-white to-[#3DA9E0]/5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-full bg-linear-to-br from-[#3DA9E0] to-[#001731] flex items-center justify-center">
                  <Award className="w-6 h-6 text-white" />
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
