'use client'

import { useTranslations } from 'next-intl'
import { ArrowLeft, Calendar, Clock } from 'lucide-react'
import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarImage } from '@repo/ui/components/ui/avatar'
import { Card } from '@repo/ui/components/ui/card'

interface MemberPortalHeaderProps {
  userName: string
  userAvatar?: string | null
  campus: string
  membershipExpiry: string
  daysRemaining: number
}

export function MemberPortalHeader({
  userName,
  userAvatar,
  campus,
  membershipExpiry,
  daysRemaining
}: MemberPortalHeaderProps) {
  const t = useTranslations('memberPortal')
  const firstName = userName.split(' ')[0]
  const initials = userName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()

  return (
    <div className="bg-linear-to-r from-[#001731] to-[#3DA9E0] text-white py-8">
      <div className="max-w-7xl mx-auto px-4">
        <Link
          href="/"
          className="flex items-center gap-2 text-white/80 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          {t('backToHome')}
        </Link>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="w-20 h-20 border-4 border-white/20">
              {userAvatar && <AvatarImage src={userAvatar} alt={userName} />}
              <AvatarFallback className="bg-white/20 text-white text-2xl">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-3xl font-bold text-white mb-1">
                {t('welcome', { name: firstName })}
              </h1>
              <p className="text-white/80">
                {t('common.member')} • {campus} {t('common.campus')}
              </p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-4">
            <Card className="px-6 py-3 bg-white/10 backdrop-blur-sm border-white/20">
              <div className="text-white/70 text-sm mb-1">
                {t('common.membershipExpires')}
              </div>
              <div className="text-white flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {new Date(membershipExpiry).toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric', 
                  year: 'numeric' 
                })}
              </div>
            </Card>
            <Card className="px-6 py-3 bg-white/10 backdrop-blur-sm border-white/20">
              <div className="text-white/70 text-sm mb-1">
                {t('common.daysRemaining')}
              </div>
              <div className="text-white flex items-center gap-2">
                <Clock className="w-4 h-4" />
                {t('overview.daysRemaining', { days: daysRemaining })}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

