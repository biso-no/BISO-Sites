import type { CampusData } from "@repo/api/types/appwrite";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { Briefcase, CheckCircle, ExternalLink, Globe } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import type { Locale } from "@/i18n/config";

type PartnersTabProps = {
  campusData: CampusData | null;
  campusName: string | null;
  locale: Locale;
};

export function PartnersTab({
  campusData,
  campusName,
  locale,
}: PartnersTabProps) {
  const businessBenefits = campusData
    ? (locale === "en"
        ? campusData.businessBenefits_en
        : campusData.businessBenefits_nb) ||
      campusData.businessBenefits_en ||
      campusData.businessBenefits_nb ||
      []
    : [];

  if (!businessBenefits || businessBenefits.length === 0) {
    return (
      <div className="py-12 text-center">
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
        animate={{ opacity: 1, y: 0 }}
        className="mb-12 text-center"
        initial={{ opacity: 0, y: 20 }}
      >
        <h2 className="mb-4 text-gray-900">
          {locale === "en" ? "Partner With Us" : "Samarbeid med oss"}
        </h2>
        <p className="mx-auto max-w-2xl text-gray-600">
          {locale === "en"
            ? `Connect with talented students and build your brand visibility${campusName ? ` at ${campusName}` : ""}`
            : `Få kontakt med talentfulle studenter og bygg din merkevaresynlighet${campusName ? ` ved ${campusName}` : ""}`}
        </p>
      </motion.div>

      <section className="space-y-8">
        <Card className="border-0 bg-linear-to-br from-[#001731]/5 to-white p-8 shadow-xl">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-linear-to-br from-[#001731] to-[#3DA9E0]">
              <Briefcase className="h-6 w-6 text-white" />
            </div>
            <h3 className="text-gray-900">
              {locale === "en"
                ? "Partnership Benefits"
                : "Partnerskapsfordeler"}
            </h3>
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
            <h3 className="mb-4 text-gray-900">
              {locale === "en" ? "Ready to Partner?" : "Klar til å samarbeide?"}
            </h3>
            <p className="mx-auto mb-8 max-w-xl text-gray-600">
              {locale === "en"
                ? "Get in touch with our partnership team to explore collaboration opportunities and create meaningful connections with students."
                : "Ta kontakt med vårt partnerskapsteam for å utforske samarbeidsmuligheter og skape meningsfulle forbindelser med studenter."}
            </p>
            <Button
              asChild
              className="bg-linear-to-r from-[#3DA9E0] to-[#001731] text-white hover:from-[#3DA9E0]/90 hover:to-[#001731]/90"
            >
              <Link href="/contact">
                {locale === "en"
                  ? "Contact Partnership Team"
                  : "Kontakt partnerskapsteamet"}
                <ExternalLink className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </motion.div>
        </Card>
      </section>
    </>
  );
}
