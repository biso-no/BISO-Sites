import { Metadata } from "next"
import { getTranslations } from 'next-intl/server'
import { PublicPageHeader } from "@/components/public/PublicPageHeader"
import { getCampuses } from "@/app/actions/campus"

export const metadata: Metadata = {
  title: "Contact | BISO",
  description: "Contact BISO nationally or at your campus.",
}

export default async function ContactPage() {
  const [t, campuses] = await Promise.all([
    getTranslations('contact'),
    getCampuses()
  ])
  return (
    <div className="space-y-6">
      <PublicPageHeader title={t('title')} breadcrumbs={[{ label: 'Home', href: '/' }, { label: t('title') }]} />
      <p className="text-sm text-muted-foreground">{t('intro')}</p>
      <div className="rounded-lg border p-4 bg-white">
        <div className="font-semibold">{t('national.title')}</div>
        <div className="text-sm text-muted-foreground">{t('national.body')}</div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {campuses.map((c) => (
          <div key={c.$id} className="rounded-lg border p-4 bg-white">
            <div className="font-semibold">{c.name}</div>
            {c.email && (
              <div className="text-sm text-muted-foreground">
                <a className="underline" href={`mailto:${c.email}`}>{c.email}</a>
              </div>
            )}
          </div>
        ))}
        {campuses.length === 0 && (
          <div className="text-sm text-muted-foreground">{t('campuses.empty')}</div>
        )}
      </div>
    </div>
  )
}
