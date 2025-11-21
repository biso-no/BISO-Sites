'use client'

import { useMemo } from 'react'
import { motion } from 'motion/react'
import { Calendar, MapPin, Users, Ticket, Clock } from 'lucide-react'
import { Badge } from '@repo/ui/components/ui/badge'
import Image from 'next/image'
import { format } from 'date-fns'
import { enUS, nb } from 'date-fns/locale'

interface EventFormData {
  slug: string
  status: 'draft' | 'published' | 'cancelled'
  campus_id: string
  start_date?: string
  end_date?: string
  location?: string
  price?: number
  ticket_url?: string
  image?: string
  member_only?: boolean
  metadata?: {
    start_time?: string
    end_time?: string
    images?: string[]
  }
  translations: {
    en: {
      title: string
      description: string
    }
    no: {
      title: string
      description: string
    }
  }
}

interface EventPreviewProps {
  data: EventFormData
  locale: 'en' | 'no'
}

export function EventPreview({ data, locale }: EventPreviewProps) {
  const translation = data.translations[locale]
  const imageUrl = data.metadata?.images?.[0] || data.image || '/images/placeholder.jpg'

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('nb-NO', {
      style: 'currency',
      currency: 'NOK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price)
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return null
    try {
      const date = new Date(dateStr)
      return format(date, 'PPP', { locale: locale === 'no' ? nb : enUS })
    } catch {
      return dateStr
    }
  }

  // Strip HTML tags for preview description (client-side safe)
  const stripHtml = (html: string) => {
    // Only run in browser environment
    if (typeof window === 'undefined') return html
    const tmp = document.createElement('DIV')
    tmp.innerHTML = html
    return tmp.textContent || tmp.innerText || ''
  }

  const shortDescription = useMemo(() => {
    if (!translation.description) return ''
    const plainText = stripHtml(translation.description)
    return plainText.length > 150 
      ? `${plainText.substring(0, 150)}...` 
      : plainText
  }, [translation.description])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="relative"
    >
      {/* Status Badge Overlay */}
      {data.status !== 'published' && (
        <div className="absolute top-2 right-2 z-10">
          <Badge 
            variant={data.status === 'draft' ? 'secondary' : 'destructive'}
            className="font-semibold uppercase text-xs"
          >
            {data.status}
          </Badge>
        </div>
      )}

      {/* Event Card */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-all hover:shadow-md">
        {/* Image */}
        <div className="relative aspect-video w-full overflow-hidden bg-gray-100">
          <Image
            src={imageUrl}
            alt={translation.title || 'Event preview'}
            fill
            className="object-cover"
            sizes="400px"
          />
          
          {/* Member Only Badge */}
          {data.member_only && (
            <div className="absolute left-3 top-3">
              <Badge className="border-blue-200 bg-blue-50 text-blue-700 font-medium">
                <Users className="mr-1 h-3 w-3" />
                {locale === 'en' ? 'Members Only' : 'Kun medlemmer'}
              </Badge>
            </div>
          )}

          {/* Price Badge */}
          {data.price !== undefined && data.price !== null && (
            <div className="absolute bottom-3 right-3 rounded-full bg-primary/90 px-3 py-1 backdrop-blur-sm">
              <span className="text-sm font-semibold text-white">
                {formatPrice(data.price)}
              </span>
            </div>
          )}

          {data.price === 0 && (
            <div className="absolute bottom-3 right-3 rounded-full bg-green-500/90 px-3 py-1 backdrop-blur-sm">
              <span className="text-sm font-semibold text-white">
                {locale === 'en' ? 'Free' : 'Gratis'}
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          {/* Title */}
          <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">
            {translation.title || (locale === 'en' ? 'Event Title' : 'Arrangementstittel')}
          </h3>

          {/* Date & Time */}
          {data.start_date && (
            <div className="flex items-start gap-2 text-sm text-gray-600">
              <Calendar className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <div>{formatDate(data.start_date)}</div>
                {(data.metadata?.start_time || data.metadata?.end_time) && (
                  <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                    <Clock className="h-3 w-3" />
                    {data.metadata.start_time}
                    {data.metadata.end_time && ` - ${data.metadata.end_time}`}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Location */}
          {data.location && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <MapPin className="h-4 w-4 shrink-0" />
              <span className="line-clamp-1">{data.location}</span>
            </div>
          )}

          {/* Description */}
          <p className="text-sm text-gray-600 line-clamp-3">
            {shortDescription || (locale === 'en' ? 'Event description...' : 'Arrangementbeskrivelse...')}
          </p>

          {/* Ticket Link */}
          {data.ticket_url && (
            <div className="flex items-center gap-2 pt-2 border-t">
              <Badge variant="outline" className="text-xs">
                <Ticket className="mr-1 h-3 w-3" />
                {locale === 'en' ? 'Tickets Available' : 'Billetter tilgjengelig'}
              </Badge>
            </div>
          )}
        </div>
      </div>

      {/* Preview Note */}
      <p className="mt-2 text-center text-xs text-muted-foreground italic">
        {locale === 'en' ? 'Live Preview' : 'Forhåndsvisning'}
      </p>
    </motion.div>
  )
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

