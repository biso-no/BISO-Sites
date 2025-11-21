import type { CampusData } from "@repo/api/types/appwrite";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { Briefcase, CheckCircle, ExternalLink, Globe } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import type { Locale } from "@/i18n/config";

interface PartnersTabProps {
  campusData: CampusData | null;
  campusName: string | null;
  locale: Locale;
}

export function PartnersTab({ campusData, campusName, locale }: PartnersTabProps) {
  const businessBenefits = campusData
    ? (locale === "en" ? campusData.businessBenefits_en : campusData.businessBenefits_nb) ||
      campusData.businessBenefits_en ||
      campusData.businessBenefits_nb ||
      []
    : [];

  if (!businessBenefits || businessBenefits.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">
          {locale === "en"
            ? "No partnership information available for this campus yet."
            : "Ingen partnerskapsinformasjon tilgjengelig for denne campusen ennå."}
        </p>
      </div>
    );
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <h2 className="text-gray-900 mb-4">
          {locale === "en" ? "Partner With Us" : "Samarbeid med oss"}
        </h2>
        <p className="text-gray-600 max-w-2xl mx-auto">
          {locale === "en"
            ? `Connect with talented students and build your brand visibility${campusName ? ` at ${campusName}` : ""}`
            : `Få kontakt med talentfulle studenter og bygg din merkevaresynlighet${campusName ? ` ved ${campusName}` : ""}`}
        </p>
      </motion.div>

      <section className="space-y-8">
        <Card className="p-8 border-0 shadow-xl bg-linear-to-br from-[#001731]/5 to-white">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-full bg-linear-to-br from-[#001731] to-[#3DA9E0] flex items-center justify-center">
              <Briefcase className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-gray-900">
              {locale === "en" ? "Partnership Benefits" : "Partnerskapsfordeler"}
            </h3>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {businessBenefits.map((benefit, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-start gap-3 p-4 bg-white rounded-lg"
              >
                <CheckCircle className="w-5 h-5 text-[#001731] shrink-0 mt-0.5" />
                <span className="text-gray-700">{benefit}</span>
              </motion.div>
            ))}
          </div>
        </Card>

        {/* CTA Card */}
        <Card className="p-12 text-center border-0 shadow-xl bg-linear-to-br from-[#3DA9E0]/10 to-[#001731]/10">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
          >
            <Globe className="w-16 h-16 text-[#3DA9E0] mx-auto mb-6" />
            <h3 className="text-gray-900 mb-4">
              {locale === "en" ? "Ready to Partner?" : "Klar til å samarbeide?"}
            </h3>
            <p className="text-gray-600 mb-8 max-w-xl mx-auto">
              {locale === "en"
                ? "Get in touch with our partnership team to explore collaboration opportunities and create meaningful connections with students."
                : "Ta kontakt med vårt partnerskapsteam for å utforske samarbeidsmuligheter og skape meningsfulle forbindelser med studenter."}
            </p>
            <Button
              asChild
              className="bg-linear-to-r from-[#3DA9E0] to-[#001731] hover:from-[#3DA9E0]/90 hover:to-[#001731]/90 text-white"
            >
              <Link href="/contact">
                {locale === "en" ? "Contact Partnership Team" : "Kontakt partnerskapsteamet"}
                <ExternalLink className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </motion.div>
        </Card>
      </section>
    </>
  );
}
