import { Metadata } from "next"
import { PublicPageHeader } from "@/components/public/PublicPageHeader"
import { getTranslations } from "next-intl/server"
import { getSitePageTranslation } from '@/app/actions/site-pages'
import { getLocale } from '@/app/actions/locale'

export const metadata: Metadata = {
  title: "Purchase Terms | BISO Shop",
  description: "Terms of sale, refunds/returns, and delivery information.",
}

export default async function TermsPage() {
  const t = await getTranslations('terms')
  const locale = await getLocale() as 'no' | 'en'
  const tr = await getSitePageTranslation('terms', locale)
  return (
    <div className="space-y-6">
      <PublicPageHeader
        title={tr?.title || t('title')}
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Terms" }]}
      />
      {tr ? (
        <article className="prose max-w-none" dangerouslySetInnerHTML={{ __html: tr.body }} />
      ) : (
        <div className="prose max-w-none space-y-4">
        <p>{t('intro')}</p>
        <h3>{t('sections.payment.title')}</h3>
        <p>{t('sections.payment.body')}</p>
        <h3>{t('sections.delivery.title')}</h3>
        <p>{t('sections.delivery.body')}</p>
        <h3>{t('sections.returns.title')}</h3>
        <p>{t('sections.returns.body')}</p>
        <h3>{t('sections.withdrawal.title')}</h3>
        <p>{t('sections.withdrawal.body')}</p>
        <h3>{t('sections.contact.title')}</h3>
        <p>{t('sections.contact.body')}</p>
        </div>
      )}
    </div>
  )
}
