import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'
import { PublicPageHeader } from '@/components/public/PublicPageHeader'
import { Button } from '@repo/ui/components/ui/button'
import Link from 'next/link'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('volunteer.meta')
  return {
    title: t('title'),
    description: t('description'),
  }
}

export default async function VolunteerPage() {
  const t = await getTranslations('volunteer')
  return (
    <div className="space-y-6">
      <PublicPageHeader
        title={t('title')}
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: t('title') }]}
      />
      <div className="prose max-w-none">
        <p>{t('intro')}</p>
        <ul>
          <li>{t('benefits.0')}</li>
          <li>{t('benefits.1')}</li>
          <li>{t('benefits.2')}</li>
        </ul>
      </div>
      <div>
        <Button asChild>
          <Link href="/jobs">{t('cta')}</Link>
        </Button>
      </div>
    </div>
  )
}

