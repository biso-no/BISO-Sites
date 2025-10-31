import { Metadata } from "next"
import { getTranslations } from 'next-intl/server'
import { PublicPageHeader } from "@/components/public/PublicPageHeader"

export const metadata: Metadata = {
  title: "Drugs and Alcohol Policy | BISO",
  description: "BISO policy related to drugs and alcohol for events and activities.",
}

export default async function DrugsPolicyPage() {
  const t = await getTranslations('policies.drugsPolicy')
  return (
    <div className="space-y-6">
      <PublicPageHeader title={t('title')} breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Policies' }, { label: t('title') }]} />
      <div className="prose max-w-none space-y-4">
        <p>{t('intro')}</p>
        <h3>{t('sections.principles.title')}</h3>
        <ul>
          <li>{t('sections.principles.items.0')}</li>
          <li>{t('sections.principles.items.1')}</li>
          <li>{t('sections.principles.items.2')}</li>
        </ul>
        <h3>{t('sections.conduct.title')}</h3>
        <p>{t('sections.conduct.body')}</p>
        <h3>{t('sections.support.title')}</h3>
        <p>{t('sections.support.body')}</p>
      </div>
    </div>
  )
}
