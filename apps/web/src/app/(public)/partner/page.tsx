import { useTranslations } from 'next-intl'
import { getTranslations } from 'next-intl/server'
import Image from 'next/image'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/components/ui/card'
import { Button } from '@repo/ui/components/ui/button'
import { Badge } from '@repo/ui/components/ui/badge'
import { Mail, Phone, MapPin, Users, Target, Handshake, Calendar, Presentation, MessageSquare, Building2, Heart, Briefcase } from 'lucide-react'
import type { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('partner.meta')
  
  return {
    title: t('title'),
    description: t('description'),
  }
}

export default function PartnerPage() {
  const t = useTranslations('partner')

  const benefits = [
    {
      key: 'colleagues',
      icon: Users,
      title: t('benefits.items.colleagues.title'),
      description: t('benefits.items.colleagues.description')
    },
    {
      key: 'values',
      icon: Heart,
      title: t('benefits.items.values.title'),
      description: t('benefits.items.values.description')
    },
    {
      key: 'match',
      icon: Target,
      title: t('benefits.items.match.title'),
      description: t('benefits.items.match.description')
    }
  ]

  const careerDays = [
    {
      key: 'oslo',
      city: 'Oslo',
      title: t('careerDays.cities.oslo.title'),
      action: t('careerDays.cities.oslo.action')
    },
    {
      key: 'bergen',
      city: 'Bergen',
      title: t('careerDays.cities.bergen.title'),
      action: t('careerDays.cities.bergen.action')
    },
    {
      key: 'trondheim',
      city: 'Trondheim',
      title: t('careerDays.cities.trondheim.title'),
      action: t('careerDays.cities.trondheim.action')
    },
    {
      key: 'stavanger',
      city: 'Stavanger',
      title: t('careerDays.cities.stavanger.title'),
      action: t('careerDays.cities.stavanger.action')
    }
  ]

  const campuses = [
    {
      key: 'oslo',
      title: t('contact.campuses.oslo.title'),
      phone: t('contact.campuses.oslo.phone'),
      email: t('contact.campuses.oslo.email'),
      address: t('contact.campuses.oslo.address')
    },
    {
      key: 'bergen',
      title: t('contact.campuses.bergen.title'),
      phone: t('contact.campuses.bergen.phone'),
      email: t('contact.campuses.bergen.email'),
      address: t('contact.campuses.bergen.address')
    },
    {
      key: 'trondheim',
      title: t('contact.campuses.trondheim.title'),
      phone: t('contact.campuses.trondheim.phone'),
      email: t('contact.campuses.trondheim.email'),
      address: t('contact.campuses.trondheim.address')
    },
    {
      key: 'stavanger',
      title: t('contact.campuses.stavanger.title'),
      phone: t('contact.campuses.stavanger.phone'),
      email: t('contact.campuses.stavanger.email'),
      address: t('contact.campuses.stavanger.address')
    }
  ]

  const businessHotspotFeatures = [
    { key: 'present', icon: Presentation, text: t('opportunities.businessHotspot.features.present') },
    { key: 'presentations', icon: Building2, text: t('opportunities.businessHotspot.features.presentations') },
    { key: 'talk', icon: MessageSquare, text: t('opportunities.businessHotspot.features.talk') },
    { key: 'stand', icon: Building2, text: t('opportunities.businessHotspot.features.stand') },
    { key: 'relationship', icon: Heart, text: t('opportunities.businessHotspot.features.relationship') },
    { key: 'agreements', icon: Handshake, text: t('opportunities.businessHotspot.features.agreements') }
  ]

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-linear-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-900 dark:to-indigo-900">
        <div className="absolute inset-0 bg-grid-slate-100 mask-[linear-gradient(0deg,white,rgba(255,255,255,0.6))] dark:bg-grid-slate-700/25 dark:mask-[linear-gradient(0deg,rgba(255,255,255,0.1),rgba(255,255,255,0.5))]" />
        <div className="relative">
          <div className="mx-auto max-w-7xl px-6 py-24 sm:py-32 lg:flex lg:items-center lg:gap-x-10 lg:px-8 lg:py-40">
            <div className="mx-auto max-w-2xl lg:mx-0 lg:flex-auto">
              <div className="flex">
                <Badge variant="secondary" className="mb-6 text-sm font-medium">
                  {t('hero.subtitle')}
                </Badge>
              </div>
              <h1 className="mt-10 max-w-lg text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-6xl">
                {t('hero.title')}
              </h1>
              <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
                {t('hero.description')}
              </p>
              <div className="mt-10 flex items-center gap-x-6">
                <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700">
                  <Link href="/contact">
                    <Mail className="mr-2 h-4 w-4" />
                    {t('buttons.contact')}
                  </Link>
                </Button>
                <Button variant="outline" size="lg" asChild>
                  <Link href="#benefits">{t('buttons.readMore')}</Link>
                </Button>
              </div>
            </div>
            <div className="mt-16 sm:mt-24 lg:mt-0 lg:shrink-0 lg:grow">
              <div className="mx-auto w-91.5 max-w-full lg:mx-0">
                <Image
                  src="/images/bedrift.png"
                  alt="Partnership illustration"
                  width={366}
                  height={366}
                  className="w-full rounded-2xl shadow-2xl ring-1 ring-gray-400/10"
                  priority
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
              {t('benefits.title')}
            </h2>
            <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
              {t('benefits.subtitle')}
            </p>
          </div>
          <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
            <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-3">
              {benefits.map((benefit) => {
                const Icon = benefit.icon
                return (
                  <div key={benefit.key} className="flex flex-col">
                    <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-gray-900 dark:text-white">
                      <Icon className="h-5 w-5 flex-none text-blue-600" aria-hidden="true" />
                      {benefit.title}
                    </dt>
                    <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-gray-600 dark:text-gray-300">
                      <p className="flex-auto">{benefit.description}</p>
                    </dd>
                  </div>
                )
              })}
            </dl>
          </div>
        </div>
      </section>

      {/* Career Days Section */}
      <section className="bg-gray-50 dark:bg-gray-900 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
              {t('careerDays.title')}
            </h2>
            <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
              {t('careerDays.description')}
            </p>
          </div>
          <div className="mx-auto mt-16 grid max-w-2xl grid-cols-1 gap-6 sm:mt-20 lg:mx-0 lg:max-w-none lg:grid-cols-2 xl:grid-cols-4">
            {careerDays.map((career) => (
              <Card key={career.key} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-blue-600" />
                    {career.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Button className="w-full bg-blue-600 hover:bg-blue-700">
                    {career.action}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Business Hotspot Section - Only for Oslo */}
      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <Badge variant="secondary" className="mb-4">
              {t('opportunities.title')}
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
              {t('opportunities.businessHotspot.title')}
            </h2>
            <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
              {t('opportunities.businessHotspot.description')}
            </p>
          </div>
          
          <div className="mx-auto mt-16 lg:mx-0 lg:max-w-none">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                  {businessHotspotFeatures.map((feature) => {
                    const Icon = feature.icon
                    return (
                      <div key={feature.key} className="flex items-center gap-3 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                        <Icon className="h-5 w-5 text-blue-600" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {feature.text}
                        </span>
                      </div>
                    )
                  })}
                </div>
                <div className="text-center lg:text-left">
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    {t('opportunities.businessHotspot.concept.title')}
                  </h3>
                  <p className="text-xl text-blue-600 font-semibold mb-6">
                    {t('opportunities.businessHotspot.concept.subtitle')}
                  </p>
                  <Button size="lg" className="bg-blue-600 hover:bg-blue-700">
                    {t('buttons.readMore')}
                  </Button>
                </div>
              </div>
              <div className="relative">
                <Image
                  src="/images/business-hotspot.png"
                  alt="Business Hotspot"
                  width={600}
                  height={400}
                  className="w-full rounded-2xl shadow-2xl"
                />
                <div className="absolute top-4 right-4">
                  <Badge className="bg-orange-500 hover:bg-orange-600">
                    Oslo Only
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="bg-gray-50 dark:bg-gray-900 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
              {t('contact.title')}
            </h2>
            <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
              {t('contact.description')}
            </p>
          </div>
          <div className="mx-auto mt-16 grid max-w-2xl grid-cols-1 gap-6 sm:mt-20 lg:mx-0 lg:max-w-none lg:grid-cols-2 xl:grid-cols-4">
            {campuses.map((campus) => (
              <Card key={campus.key} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="text-center">
                    {campus.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3 text-sm">
                    <Phone className="h-4 w-4 text-blue-600 shrink-0" />
                    <span className="text-gray-600 dark:text-gray-300">{campus.phone}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Mail className="h-4 w-4 text-blue-600 shrink-0" />
                    <Link 
                      href={`mailto:${campus.email}`}
                      className="text-blue-600 hover:text-blue-700 underline"
                    >
                      {campus.email}
                    </Link>
                  </div>
                  <div className="flex items-start gap-3 text-sm">
                    <MapPin className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                    <span className="text-gray-600 dark:text-gray-300">{campus.address}</span>
                  </div>
                  <Button className="w-full mt-4 bg-blue-600 hover:bg-blue-700">
                    <Mail className="mr-2 h-4 w-4" />
                    {t('buttons.contact')}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
