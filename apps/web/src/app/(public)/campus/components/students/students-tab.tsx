import type { CampusData } from "@repo/api/types/appwrite";
import { Heart, Shield, TrendingUp, Users } from "lucide-react";
import { motion } from "motion/react";
import type { Locale } from "@/i18n/config";
import { BenefitsSection } from "./benefits-section";

interface StudentsTabProps {
  campusData: CampusData | null;
  locale: Locale;
}

export function StudentsTab({ campusData, locale }: StudentsTabProps) {
  const studentBenefits = campusData
    ? (locale === "en"
        ? campusData.studentBenefits_en
        : campusData.studentBenefits_nb) ||
      campusData.studentBenefits_en ||
      campusData.studentBenefits_nb ||
      []
    : [];

  const careerAdvantages = campusData
    ? (locale === "en"
        ? campusData.careerAdvantages_en
        : campusData.careerAdvantages_nb) ||
      campusData.careerAdvantages_en ||
      campusData.careerAdvantages_nb ||
      []
    : [];

  const socialNetwork = campusData
    ? (locale === "en"
        ? campusData.socialNetwork_en
        : campusData.socialNetwork_nb) ||
      campusData.socialNetwork_en ||
      campusData.socialNetwork_nb ||
      []
    : [];

  const safety = campusData
    ? (locale === "en" ? campusData.safety_en : campusData.safety_nb) ||
      campusData.safety_en ||
      campusData.safety_nb ||
      []
    : [];

  const hasBenefits =
    studentBenefits.length > 0 ||
    careerAdvantages.length > 0 ||
    socialNetwork.length > 0 ||
    safety.length > 0;

  if (!hasBenefits) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">
          {locale === "en"
            ? "No benefits information available for this campus yet."
            : "Ingen fordelsinformasjon tilgjengelig for denne campusen ennå."}
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
          {locale === "en"
            ? "Member Benefits & Advantages"
            : "Medlemsfordeler og -fordeler"}
        </h2>
        <p className="text-gray-600 max-w-2xl mx-auto">
          {locale === "en"
            ? "Unlock exclusive opportunities and support throughout your student journey"
            : "Lås opp eksklusive muligheter og støtte gjennom hele studietiden"}
        </p>
      </motion.div>

      <div className="space-y-8">
        {studentBenefits.length > 0 && (
          <BenefitsSection
            title={locale === "en" ? "Membership Benefits" : "Medlemsfordeler"}
            description={
              locale === "en"
                ? "Exclusive perks and discounts for BISO members"
                : "Eksklusive fordeler og rabatter for BISO-medlemmer"
            }
            icon={Users}
            items={studentBenefits}
            colorScheme="blue"
          />
        )}

        {careerAdvantages.length > 0 && (
          <BenefitsSection
            title={locale === "en" ? "Career Advantages" : "Karrierefordeler"}
            description={
              locale === "en"
                ? "Build your professional network and enhance your CV"
                : "Bygg ditt profesjonelle nettverk og forbedre CV-en din"
            }
            icon={TrendingUp}
            items={careerAdvantages}
            colorScheme="green"
          />
        )}

        {socialNetwork.length > 0 && (
          <BenefitsSection
            title={locale === "en" ? "Social Network" : "Sosialt nettverk"}
            description={
              locale === "en"
                ? "Connect with fellow students and build lasting friendships"
                : "Koble til med medstudenter og bygg varige vennskap"
            }
            icon={Heart}
            items={socialNetwork}
            colorScheme="pink"
          />
        )}

        {safety.length > 0 && (
          <BenefitsSection
            title={locale === "en" ? "Safety & Support" : "Trygghet og støtte"}
            description={
              locale === "en"
                ? "We ensure a safe and supportive environment for all members"
                : "Vi sikrer et trygt og støttende miljø for alle medlemmer"
            }
            icon={Shield}
            items={safety}
            colorScheme="purple"
          />
        )}
      </div>
    </>
  );
}
