import type { Locale } from "@repo/i18n/config";
import {
  benefitsForCampus,
  type PublicBenefit,
} from "@repo/shared/utils/benefit-public";
import { Heart, Shield, TrendingUp, Users } from "lucide-react";
import { motion } from "motion/react";
import { localizedPublicBenefitText } from "@/lib/benefit-text";
import { BenefitsSection } from "./benefits-section";

interface StudentsTabProps {
  benefits: PublicBenefit[];
  /** Selected campus; `null` shows the national benefits only. */
  campusId: string | null;
  locale: Locale;
}

const copy = {
  en: {
    heading: "Member Benefits & Advantages",
    description:
      "Unlock exclusive opportunities and support throughout your student journey",
    empty: "No benefits information available for this campus yet.",
    memberPortalLink: "See all offers and codes in the member portal",
    membership: {
      title: "Membership Benefits",
      description: "Exclusive perks and discounts for BISO members",
    },
    career: {
      title: "Career Advantages",
      description: "Build your professional network and enhance your CV",
    },
    social: {
      title: "Social Network",
      description: "Connect with fellow students and build lasting friendships",
    },
    safety: {
      title: "Safety & Support",
      description:
        "We ensure a safe and supportive environment for all members",
    },
  },
  no: {
    heading: "Medlemsfordeler og -fordeler",
    description:
      "Lås opp eksklusive muligheter og støtte gjennom hele studietiden",
    empty: "Ingen fordelsinformasjon tilgjengelig for denne campusen ennå.",
    memberPortalLink: "Se alle tilbud og koder i medlemsportalen",
    membership: {
      title: "Medlemsfordeler",
      description: "Eksklusive fordeler og rabatter for BISO-medlemmer",
    },
    career: {
      title: "Karrierefordeler",
      description: "Bygg ditt profesjonelle nettverk og forbedre CV-en din",
    },
    social: {
      title: "Sosialt nettverk",
      description: "Koble til med medstudenter og bygg varige vennskap",
    },
    safety: {
      title: "Trygghet og støtte",
      description: "Vi sikrer et trygt og støttende miljø for alle medlemmer",
    },
  },
};

const SECTIONS = [
  {
    colorScheme: "blue",
    copyKey: "membership",
    icon: Users,
    section: "member",
  },
  {
    colorScheme: "green",
    copyKey: "career",
    icon: TrendingUp,
    section: "career",
  },
  { colorScheme: "pink", copyKey: "social", icon: Heart, section: "social" },
  {
    colorScheme: "purple",
    copyKey: "safety",
    icon: Shield,
    section: "safety",
  },
] as const;

export function StudentsTab({ benefits, campusId, locale }: StudentsTabProps) {
  const localeCopy = locale === "en" ? copy.en : copy.no;

  const cards = SECTIONS.map((config) => ({
    ...config,
    items: benefitsForCampus(benefits, campusId, [config.section]).map(
      (benefit) => localizedPublicBenefitText(benefit, locale).title
    ),
  })).filter((card) => card.items.length > 0);

  if (cards.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">{localeCopy.empty}</p>
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
        <h2 className="mb-4 font-bold text-2xl text-foreground md:text-3xl">
          {localeCopy.heading}
        </h2>
        <p className="mx-auto max-w-2xl text-muted-foreground">
          {localeCopy.description}
        </p>
      </motion.div>

      <div className="space-y-8">
        {cards.map((card) => (
          <BenefitsSection
            colorScheme={card.colorScheme}
            description={localeCopy[card.copyKey].description}
            footerLink={
              card.section === "member"
                ? { href: "/member", label: localeCopy.memberPortalLink }
                : undefined
            }
            icon={card.icon}
            items={card.items}
            key={card.section}
            title={localeCopy[card.copyKey].title}
          />
        ))}
      </div>
    </>
  );
}
