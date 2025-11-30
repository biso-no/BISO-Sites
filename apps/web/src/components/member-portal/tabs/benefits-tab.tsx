import type { MemberBenefit } from "@repo/api/types/appwrite";
import { Badge } from "@repo/ui/components/ui/badge";
import { TabsContent } from "@repo/ui/components/ui/tabs";
import { useTranslations } from "next-intl";
import { BenefitCard } from "../shared/benefit-card";
import { LockedContentOverlay } from "../shared/locked-content-overlay";

type BenefitsTabProps = {
  benefits: MemberBenefit[];
  revealedBenefits: Set<string>;
  isMember: boolean;
  hasBIIdentity: boolean;
};

export function BenefitsTab({
  benefits,
  revealedBenefits,
  isMember,
  hasBIIdentity,
}: BenefitsTabProps) {
  const t = useTranslations("memberPortal.benefits");

  const content = (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="mb-2 font-bold text-2xl text-gray-900 dark:text-gray-100">
            {t("title")}
          </h2>
          <p className="text-gray-600 dark:text-gray-400">{t("description")}</p>
        </div>
        <Badge className="border-[#3DA9E0]/30 bg-[#3DA9E0]/10 px-4 py-2 text-[#3DA9E0]">
          {t("available", { count: benefits.length })}
        </Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {benefits.map((benefit) => (
          <BenefitCard
            benefit={benefit}
            isRevealed={revealedBenefits.has(benefit.id)}
            key={benefit.id}
          />
        ))}
      </div>
    </>
  );

  return (
    <TabsContent className="space-y-8" value="benefits">
      {isMember ? (
        content
      ) : (
        <LockedContentOverlay hasBIIdentity={hasBIIdentity}>
          {content}
        </LockedContentOverlay>
      )}
    </TabsContent>
  );
}
