import { Metadata } from "next"
import { PublicPageHeader } from "@/components/public/PublicPageHeader"
import { getTranslations } from "next-intl/server"
import { getSitePageTranslation } from '@/app/actions/site-pages'
import { getLocale } from '@/app/actions/locale'

export const metadata: Metadata = {
  title: "Cookies | BISO",
  description: "Cookie categories and how we use them.",
}

export default async function CookiesPage() {
  const t = await getTranslations('cookies')
  const locale = await getLocale() as 'no' | 'en'
  const tr = await getSitePageTranslation('cookies', locale)
  return (
    <div className="space-y-6">
      <PublicPageHeader
        title={tr?.title || t('title')}
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Cookies" }]}
      />
      {tr ? (
        <article className="prose max-w-none" dangerouslySetInnerHTML={{ __html: tr.body }} />
      ) : (
        <div className="prose max-w-none space-y-4">
        <p>{t('intro')}</p>
        <h3>{t('sections.categories.title')}</h3>
        <ul>
          <li>{t('sections.categories.items.0')}</li>
          <li>{t('sections.categories.items.1')}</li>
          <li>{t('sections.categories.items.2')}</li>
          <li>{t('sections.categories.items.3')}</li>
        </ul>
        <h3>{t('sections.manage.title')}</h3>
        <p>{t('sections.manage.body')}</p>
        </div>
      )}
    </div>
  )
}
