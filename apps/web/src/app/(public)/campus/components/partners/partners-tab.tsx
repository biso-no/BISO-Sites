import type { CampusData } from "@repo/api/types/appwrite";
import type { Locale } from "@repo/i18n/config";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { Briefcase, CheckCircle, ExternalLink, Globe } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";

type PartnersTabProps = {
  campusData: CampusData | null;
  campusName: string | null;
  locale: Locale;
};

const partnerCopy = {
  en: {
    heading: "Partner With Us",
    lead: (campusName?: string | null) =>
      `Connect with talented students and build your brand visibility${campusName ? ` at ${campusName}` : ""}`,
    empty: "No partnership information available for this campus yet.",
    benefitsTitle: "Partnership Benefits",
    ctaHeading: "Ready to Partner?",
    ctaBody:
      "Get in touch with our partnership team to explore collaboration opportunities and create meaningful connections with students.",
    ctaButton: "Contact Partnership Team",
  },
  no: {
    heading: "Samarbeid med oss",
    lead: (campusName?: string | null) =>
      `Få kontakt med talentfulle studenter og bygg din merkevaresynlighet${campusName ? ` ved ${campusName}` : ""}`,
    empty:
      "Ingen partnerskapsinformasjon tilgjengelig for denne campusen ennå.",
    benefitsTitle: "Partnerskapsfordeler",
    ctaHeading: "Klar til å samarbeide?",
    ctaBody:
      "Ta kontakt med vårt partnerskapsteam for å utforske samarbeidsmuligheter og skape meningsfulle forbindelser med studenter.",
    ctaButton: "Kontakt partnerskapsteamet",
  },
};

const getBusinessBenefits = (
  campusData: CampusData | null,
  locale: Locale
): string[] => {
  if (!campusData) {
    return [];
  }
  const primary =
    locale === "en"
      ? campusData.businessBenefits_en
      : campusData.businessBenefits_nb;
  const fallback =
    locale === "en"
      ? campusData.businessBenefits_nb
      : campusData.businessBenefits_en;
  return primary || fallback || [];
};

export function PartnersTab({
  campusData,
  campusName,
  locale,
}: PartnersTabProps) {
  const localeCopy = locale === "en" ? partnerCopy.en : partnerCopy.no;
  const businessBenefits = getBusinessBenefits(campusData, locale);

  if (!businessBenefits || businessBenefits.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-gray-600">{localeCopy.empty}</p>
      </div>
    );
  }

  return (
    <>
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="mb-12 text-center"
        initial={{ opacity: 0, y: 20 }}
      >
        <h2 className="mb-4 text-gray-900">{localeCopy.heading}</h2>
        <p className="mx-auto max-w-2xl text-gray-600">
          {localeCopy.lead(campusName)}
        </p>
      </motion.div>

      <section className="space-y-8">
        <Card className="border-0 bg-linear-to-br from-[#001731]/5 to-white p-8 shadow-xl">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-linear-to-br from-[#001731] to-[#3DA9E0]">
              <Briefcase className="h-6 w-6 text-white" />
            </div>
            <h3 className="text-gray-900">{localeCopy.benefitsTitle}</h3>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {businessBenefits.map((benefit, index) => (
              <motion.div
                animate={{ opacity: 1, x: 0 }}
                className="flex items-start gap-3 rounded-lg bg-white p-4"
                initial={{ opacity: 0, x: -20 }}
                key={index}
                transition={{ delay: index * 0.05 }}
              >
                <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#001731]" />
                <span className="text-gray-700">{benefit}</span>
              </motion.div>
            ))}
          </div>
        </Card>

        {/* CTA Card */}
        <Card className="border-0 bg-linear-to-br from-[#3DA9E0]/10 to-[#001731]/10 p-12 text-center shadow-xl">
          <motion.div
            animate={{ opacity: 1, scale: 1 }}
            initial={{ opacity: 0, scale: 0.95 }}
            transition={{ delay: 0.2 }}
          >
            <Globe className="mx-auto mb-6 h-16 w-16 text-[#3DA9E0]" />
            <h3 className="mb-4 text-gray-900">{localeCopy.ctaHeading}</h3>
            <p className="mx-auto mb-8 max-w-xl text-gray-600">
              {localeCopy.ctaBody}
            </p>
            <Button
              asChild
              className="bg-linear-to-r from-[#3DA9E0] to-[#001731] text-white hover:from-[#3DA9E0]/90 hover:to-[#001731]/90"
            >
              <Link href="/contact">
                {localeCopy.ctaButton}
                <ExternalLink className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </motion.div>
        </Card>
      </section>
    </>
  );
}
