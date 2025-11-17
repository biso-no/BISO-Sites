import { useTranslations } from 'next-intl'
import { Shield, Gift, Clock, TrendingUp, Check } from 'lucide-react'
import { TabsContent } from '@repo/ui/components/ui/tabs'
import { Card } from '@repo/ui/components/ui/card'
import { Button } from '@repo/ui/components/ui/button'
import { Badge } from '@repo/ui/components/ui/badge'
import { Separator } from '@repo/ui/components/ui/separator'
import { Progress } from '@repo/ui/components/ui/progress'
import { QuickStatsCard } from '../shared/QuickStatsCard'
import { BenefitCard } from '../shared/BenefitCard'
import { LockedContentOverlay } from '../shared/LockedContentOverlay'
import type { MemberBenefit } from '@repo/api/types/appwrite'

interface OverviewTabProps {
  membershipType: string
  benefitsCount: number
  daysRemaining: number
  estimatedSavings: number
  startDate: string
  expiryDate: string
  benefits: MemberBenefit[]
  revealedBenefits: Set<string>
  isMember: boolean
  hasBIIdentity: boolean
  onTabChange: (tab: string) => void
}

export function OverviewTab({
  membershipType,
  benefitsCount,
  daysRemaining,
  estimatedSavings,
  startDate,
  expiryDate,
  benefits,
  revealedBenefits,
  isMember,
  hasBIIdentity,
  onTabChange
}: OverviewTabProps) {
  const t = useTranslations('memberPortal.overview')
  const tCommon = useTranslations('memberPortal.common')

  const featuredBenefits = benefits.slice(0, 3)
  const progressPercentage = (daysRemaining / 365) * 100

  const content = (
    <>
      {/* Quick Stats */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <QuickStatsCard
          icon={Shield}
          iconColor="bg-gradient-to-br from-[#3DA9E0] to-[#001731]"
          value={membershipType}
          label={t('stats.membershipType')}
          badge={{
            text: tCommon('status.active'),
            className: 'bg-green-100 text-green-700 border-green-200'
          }}
        />

        <QuickStatsCard
          icon={Gift}
          iconColor="bg-gradient-to-br from-purple-500 to-purple-700"
          value={t('stats.benefitsCount', { count: benefitsCount })}
          label={t('stats.benefitsAvailable')}
        />

        <QuickStatsCard
          icon={Clock}
          iconColor="bg-gradient-to-br from-orange-500 to-orange-700"
          value={t('daysRemaining', { days: daysRemaining })}
          label={t('stats.daysUntilRenewal')}
        />

        <QuickStatsCard
          icon={TrendingUp}
          iconColor="bg-gradient-to-br from-green-500 to-green-700"
          value={`~${estimatedSavings} NOK`}
          label={t('stats.estimatedSavings')}
        />
      </div>

      {/* Featured Benefits */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('featuredBenefits')}</h2>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => onTabChange('benefits')}
            className="border-[#3DA9E0]/20 text-[#3DA9E0] hover:bg-[#3DA9E0]/10"
          >
            {t('viewAll')}
          </Button>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {featuredBenefits.map((benefit) => (
            <BenefitCard
              key={benefit.id}
              benefit={benefit}
              isRevealed={revealedBenefits.has(benefit.id)}
            />
          ))}
        </div>
      </div>

      {/* Membership Status */}
      <Card className="p-8 border-0 shadow-lg bg-gradient-to-br from-[#3DA9E0]/10 to-[#001731]/10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              {t('membershipStatus')}
            </h3>
            <p className="text-gray-600 dark:text-gray-400">{t('statusActive')}</p>
          </div>
          <Badge className="bg-green-100 text-green-700 border-green-200 px-4 py-2">
            <Check className="w-4 h-4 mr-2" />
            {tCommon('status.active')}
          </Badge>
        </div>

        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600 dark:text-gray-400">{t('timeRemaining')}</span>
              <span className="text-gray-900 dark:text-gray-100 font-medium">
                {t('daysRemaining', { days: daysRemaining })}
              </span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </div>

          <Separator />

          <div className="grid sm:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600 dark:text-gray-400">{t('started')}</span>
              <span className="text-gray-900 dark:text-gray-100 ml-2 font-medium">
                {new Date(startDate).toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric', 
                  year: 'numeric' 
                })}
              </span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">{t('expires')}</span>
              <span className="text-gray-900 dark:text-gray-100 ml-2 font-medium">
                {new Date(expiryDate).toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric', 
                  year: 'numeric' 
                })}
              </span>
            </div>
          </div>

          <Button className="w-full bg-gradient-to-r from-[#3DA9E0] to-[#001731] hover:from-[#3DA9E0]/90 hover:to-[#001731]/90 text-white">
            {t('renewMembership')}
          </Button>
        </div>
      </Card>
    </>
  )

  return (
    <TabsContent value="overview" className="space-y-8">
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

