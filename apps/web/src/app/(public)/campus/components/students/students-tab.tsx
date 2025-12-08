import type { CampusData } from "@repo/api/types/appwrite";
import type { Locale } from "@repo/i18n/config";
import { Heart, Shield, TrendingUp, Users } from "lucide-react";
import { motion } from "motion/react";
import { BenefitsSection } from "./benefits-section";

type StudentsTabProps = {
  campusData: CampusData | null;
  locale: Locale;
};

const copy = {
  en: {
    heading: "Member Benefits & Advantages",
    description:
      "Unlock exclusive opportunities and support throughout your student journey",
    empty: "No benefits information available for this campus yet.",
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

const pickCampusList = (
  campusData: CampusData | null,
  locale: Locale,
  enKey: keyof CampusData,
  nbKey: keyof CampusData
) => {
  if (!campusData) {
    return [];
  }
  const primary = locale === "en" ? campusData[enKey] : campusData[nbKey];
  const secondary = locale === "en" ? campusData[nbKey] : campusData[enKey];
  return (
    (primary as string[] | undefined) ||
    (secondary as string[] | undefined) ||
    []
  );
};

export function StudentsTab({ campusData, locale }: StudentsTabProps) {
  const localeCopy = locale === "en" ? copy.en : copy.no;
  const studentBenefits = pickCampusList(
    campusData,
    locale,
    "studentBenefits_en",
    "studentBenefits_nb"
  );

  const careerAdvantages = pickCampusList(
    campusData,
    locale,
    "careerAdvantages_en",
    "careerAdvantages_nb"
  );

  const socialNetwork = pickCampusList(
    campusData,
    locale,
    "socialNetwork_en",
    "socialNetwork_nb"
  );

  const safety = pickCampusList(campusData, locale, "safety_en", "safety_nb");

  const hasBenefits =
    studentBenefits.length > 0 ||
    careerAdvantages.length > 0 ||
    socialNetwork.length > 0 ||
    safety.length > 0;

  if (!hasBenefits) {
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
        <h2 className="mb-4 text-foreground">{localeCopy.heading}</h2>
        <p className="mx-auto max-w-2xl text-muted-foreground">
          {localeCopy.description}
        </p>
      </motion.div>

      <div className="space-y-8">
        {studentBenefits.length > 0 && (
          <BenefitsSection
            colorScheme="blue"
            description={localeCopy.membership.description}
            icon={Users}
            items={studentBenefits}
            title={localeCopy.membership.title}
          />
        )}

        {careerAdvantages.length > 0 && (
          <BenefitsSection
            colorScheme="green"
            description={localeCopy.career.description}
            icon={TrendingUp}
            items={careerAdvantages}
            title={localeCopy.career.title}
          />
        )}

        {socialNetwork.length > 0 && (
          <BenefitsSection
            colorScheme="pink"
            description={localeCopy.social.description}
            icon={Heart}
            items={socialNetwork}
            title={localeCopy.social.title}
          />
        )}

        {safety.length > 0 && (
          <BenefitsSection
            colorScheme="purple"
            description={localeCopy.safety.description}
            icon={Shield}
            items={safety}
            title={localeCopy.safety.title}
          />
        )}
      </div>
    </>
  );
}
