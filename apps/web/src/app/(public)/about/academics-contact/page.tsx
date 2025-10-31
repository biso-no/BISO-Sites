"use client";
import { useTranslations } from 'next-intl'
import { PublicPageHeader } from '@/components/public/PublicPageHeader'

export default function AcademicsContactPage() {
  const t = useTranslations('academicsContact')
  return (
    <div className="space-y-6">
      <PublicPageHeader
        title={t('title')}
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'About BISO', href: '/about' }, { label: t('title') }]}
      />
      <div className="prose max-w-none">
        <p>{t('intro')}</p>
        <p>{t('body')}</p>
      </div>
    </div>
  )
}

