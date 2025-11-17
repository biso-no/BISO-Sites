import { useTranslations } from 'next-intl'
import { TabsContent } from '@repo/ui/components/ui/tabs'
import { Badge } from '@repo/ui/components/ui/badge'
import { BenefitCard } from '../shared/BenefitCard'
import { LockedContentOverlay } from '../shared/LockedContentOverlay'
import type { MemberBenefit } from '@repo/api/types/appwrite'

interface BenefitsTabProps {
  benefits: MemberBenefit[]
  revealedBenefits: Set<string>
  isMember: boolean
  hasBIIdentity: boolean
}

export function BenefitsTab({ benefits, revealedBenefits, isMember, hasBIIdentity }: BenefitsTabProps) {
  const t = useTranslations('memberPortal.benefits')

  const content = (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">{t('title')}</h2>
          <p className="text-gray-600 dark:text-gray-400">{t('description')}</p>
        </div>
        <Badge className="bg-[#3DA9E0]/10 text-[#3DA9E0] border-[#3DA9E0]/30 px-4 py-2">
          {t('available', { count: benefits.length })}
        </Badge>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {benefits.map((benefit) => (
          <BenefitCard
            key={benefit.id}
            benefit={benefit}
            isRevealed={revealedBenefits.has(benefit.id)}
          />
        ))}
      </div>
    </>
  )

  return (
    <TabsContent value="benefits" className="space-y-8">
      {!isMember ? (
        <LockedContentOverlay hasBIIdentity={hasBIIdentity}>
          {content}
        </LockedContentOverlay>
      ) : (
        content
      )}
    </TabsContent>
  )
}

