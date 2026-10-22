import type { Locale } from "@repo/i18n/config";
import {
  benefitsForCampus,
  type PublicBenefit,
} from "@repo/shared/utils/benefit-public";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { Briefcase, CheckCircle, ExternalLink, Globe } from "lucide-react";
import { motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { localizedPublicBenefitText } from "@/lib/benefit-text";
import type { CampusLogo } from "@/lib/data/benefits";

interface PartnersTabProps {
  benefits: PublicBenefit[];
  /** Selected campus; `null` shows national benefits and every campus's logos. */
  campusId: string | null;
  campusLogos: CampusLogo[];
  campusName: string | null;
  locale: Locale;
}

const partnerCopy = {
  en: {
    heading: "Partner With Us",
    lead: (campusName?: string | null) =>
      `Connect with talented students and build your brand visibility${campusName ? ` at ${campusName}` : ""}`,
    empty: "No partnership information available for this campus yet.",
    benefitsTitle: "Partnership Benefits",
    logosTitle: "Our campus partners",
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
    logosTitle: "Våre campuspartnere",
    ctaHeading: "Klar til å samarbeide?",
    ctaBody:
      "Ta kontakt med vårt partnerskapsteam for å utforske samarbeidsmuligheter og skape meningsfulle forbindelser med studenter.",
    ctaButton: "Kontakt partnerskapsteamet",
  },
};

export function PartnersTab({
  benefits,
  campusId,
  campusLogos,
  campusName,
  locale,
}: PartnersTabProps) {
  const localeCopy = locale === "en" ? partnerCopy.en : partnerCopy.no;
  const businessItems = benefitsForCampus(benefits, campusId, ["business"]).map(
    (benefit) => ({
      id: benefit.id,
      title: localizedPublicBenefitText(benefit, locale).title,
    })
  );
  const logos = campusId
    ? campusLogos.filter((logo) => logo.campusId === campusId)
    : campusLogos;
  const hasNothing = businessItems.length === 0 && logos.length === 0;

  return (
    <>
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="mb-12 text-center"
        initial={{ opacity: 0, y: 20 }}
      >
        <h2 className="mb-4 font-bold text-2xl text-foreground md:text-3xl">
          {localeCopy.heading}
        </h2>
        <p className="mx-auto max-w-2xl text-muted-foreground">
          {localeCopy.lead(campusName)}
        </p>
      </motion.div>

      <section className="space-y-8">
        {hasNothing && (
          <p className="text-center text-muted-foreground">
            {localeCopy.empty}
          </p>
        )}

        {businessItems.length > 0 && (
          <Card className="border-0 bg-linear-to-br from-brand-muted to-white p-8 shadow-xl">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-linear-to-br from-brand-gradient-to to-brand-gradient-from">
                <Briefcase className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-foreground">{localeCopy.benefitsTitle}</h3>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {businessItems.map((benefit, index) => (
                <motion.div
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-start gap-3 rounded-lg bg-background p-4"
                  initial={{ opacity: 0, x: -20 }}
                  key={benefit.id}
                  transition={{ delay: index * 0.05 }}
                >
                  <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-brand-dark" />
                  <span className="text-muted-foreground">{benefit.title}</span>
                </motion.div>
              ))}
            </div>
          </Card>
        )}

        {logos.length > 0 && (
          <Card className="border-0 bg-background p-8 shadow-xl">
            <h3 className="mb-6 text-center text-foreground">
              {localeCopy.logosTitle}
            </h3>
            <ul className="flex flex-wrap items-center justify-center gap-6">
              {logos.map((logo) => {
                const image = (
                  <Image
                    alt={logo.name}
                    className="h-16 w-auto max-w-40 object-contain"
                    height={64}
                    src={logo.imageUrl}
                    unoptimized
                    width={160}
                  />
                );
                return (
                  <li key={logo.id}>
                    {logo.url ? (
                      <a
                        href={logo.url}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        {image}
                      </a>
                    ) : (
                      image
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        )}

        {/* CTA Card */}
        <Card className="border-0 bg-linear-to-br from-brand-muted to-brand-muted p-12 text-center shadow-xl">
          <motion.div
            animate={{ opacity: 1, scale: 1 }}
            initial={{ opacity: 0, scale: 0.95 }}
            transition={{ delay: 0.2 }}
          >
            <Globe className="mx-auto mb-6 h-16 w-16 text-brand" />
            <h3 className="mb-4 text-foreground">{localeCopy.ctaHeading}</h3>
            <p className="mx-auto mb-8 max-w-xl text-muted-foreground">
              {localeCopy.ctaBody}
            </p>
            <Button
              asChild
              className="bg-linear-to-r from-brand-gradient-from to-brand-gradient-to text-white hover:from-brand-gradient-from/90 hover:to-brand-gradient-to/90"
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
