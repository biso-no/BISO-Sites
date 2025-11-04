'use client'

import { motion } from 'motion/react'
import { Calendar, MapPin, Clock, Users, Tag, ExternalLink, ArrowRight, Layers } from 'lucide-react'
import { Card } from '@repo/ui/components/ui/card'
import { Button } from '@repo/ui/components/ui/button'
import { Badge } from '@repo/ui/components/ui/badge'
import { ImageWithFallback } from '@repo/ui/components/image'
import type { ContentTranslations } from '@repo/api/types/appwrite'
import { format } from 'date-fns'
import { parseEventMetadata, formatEventPrice, getEventCategory, type EventCategory } from '@/lib/types/event'

interface EventCardProps {
  event: ContentTranslations
  index: number
  isMember?: boolean
  onViewDetails: (event: ContentTranslations) => void
}

const categoryColors: Record<EventCategory, string> = {
  Social: 'bg-purple-100 text-purple-700 border-purple-200',
  Career: 'bg-blue-100 text-blue-700 border-blue-200',
  Academic: 'bg-green-100 text-green-700 border-green-200',
  Sports: 'bg-orange-100 text-orange-700 border-orange-200',
  Culture: 'bg-pink-100 text-pink-700 border-pink-200',
}

export function EventCard({ event, index, isMember = false, onViewDetails }: EventCardProps) {
  const eventData = event.event_ref
  
  // Parse metadata if available
  const metadata = parseEventMetadata(eventData?.metadata)
  const category = getEventCategory(metadata)
  
  // Format dates
  const startDate = eventData?.start_date 
    ? format(new Date(eventData.start_date), 'MMMM d, yyyy')
    : 'TBA'
  
  const startTime = eventData?.start_date 
    ? format(new Date(eventData.start_date), 'HH:mm')
    : ''
  
  const endTime = eventData?.end_date 
    ? format(new Date(eventData.end_date), 'HH:mm')
    : ''
  
  const timeRange = startTime && endTime ? `${startTime} - ${endTime}` : startTime || 'TBA'
  
  // Format price
  const price = formatEventPrice(eventData?.price)
  const memberPrice = metadata.member_price 
    ? formatEventPrice(metadata.member_price)
    : null
  
  // Get attendees from metadata
  const attendees = metadata.attendees || 0
  
  // Get image URL
  const imageUrl = eventData?.image || 'https://images.unsplash.com/photo-1758270705657-f28eec1a5694'
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      <Card className="overflow-hidden border-0 shadow-lg hover:shadow-2xl transition-all duration-300 group h-full flex flex-col">
        {/* Image */}
        <div className="relative h-56 overflow-hidden">
          <ImageWithFallback
            src={imageUrl}
            alt={event.title}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent" />
          
            <div className="absolute top-4 left-4 flex flex-col gap-2">
            <div className="flex gap-2">
              <Badge className={`${categoryColors[category] || categoryColors.Social}`}>
                {category}
              </Badge>
              {eventData?.is_collection && (
                <Badge className="bg-[#3DA9E0] text-white border-0 flex items-center gap-1">
                  <Layers className="w-3 h-3" />
                  Collection
                </Badge>
              )}
            </div>
            {eventData?.member_only && (
              <Badge className="bg-orange-500 text-white border-0 flex items-center gap-1 w-fit">
                <Users className="w-3 h-3" />
                Members Only
              </Badge>
            )}
            {!eventData?.member_only && memberPrice && (
              <Badge className="bg-green-500 text-white border-0 flex items-center gap-1 w-fit">
                <Tag className="w-3 h-3" />
                Member Discount
              </Badge>
            )}
            {eventData?.ticket_url && (
              <Badge className="bg-purple-500 text-white border-0 flex items-center gap-1 w-fit">
                <ExternalLink className="w-3 h-3" />
                Tickster
              </Badge>
            )}
          </div>
          
          <div className="absolute bottom-4 right-4 px-3 py-1 rounded-full bg-white/90 backdrop-blur-sm">
            <span className="text-[#001731] font-medium">{price}</span>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col grow">
          <h3 className="mb-3 text-gray-900 text-xl font-semibold">{event.title}</h3>
          <p className="text-gray-600 mb-4 grow line-clamp-2 text-sm">{event.description}</p>

          {eventData?.is_collection && (
            <div className="mb-4 p-3 bg-[#3DA9E0]/10 rounded-lg border border-[#3DA9E0]/20">
              <p className="text-sm text-[#001731] mb-1">
                <Layers className="w-4 h-4 inline mr-1" />
                Multi-day event collection
              </p>
              {eventData.collection_pricing === 'bundle' && (
                <p className="text-sm text-[#3DA9E0] mt-1">
                  • Bundle pricing: One ticket for all events
                </p>
              )}
              {eventData.collection_pricing === 'individual' && (
                <p className="text-sm text-[#3DA9E0] mt-1">
                  • Individual pricing: Register for each event separately
                </p>
              )}
            </div>
          )}

          <div className="space-y-2 mb-6">
            <div className="flex items-center gap-2 text-gray-600 text-sm">
              <Calendar className="w-4 h-4 text-[#3DA9E0]" />
              <span>{startDate}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600 text-sm">
              <Clock className="w-4 h-4 text-[#3DA9E0]" />
              <span>{timeRange}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600 text-sm">
              <MapPin className="w-4 h-4 text-[#3DA9E0]" />
              <span>{eventData?.location || 'Location TBA'}</span>
            </div>
            {attendees > 0 && (
              <div className="flex items-center gap-2 text-gray-600 text-sm">
                <Users className="w-4 h-4 text-[#3DA9E0]" />
                <span>{attendees} attending</span>
              </div>
            )}
            
            {/* Price */}
            <div className="mt-3 pt-3 border-t border-gray-200">
              {memberPrice && !isMember ? (
                <div>
                  <div className="text-gray-900 font-medium">{price}</div>
                  <div className="text-sm text-[#3DA9E0] mt-1">
                    Members: {memberPrice}
                  </div>
                </div>
              ) : memberPrice && isMember ? (
                <div>
                  <div className="text-gray-400 line-through text-sm">{price}</div>
                  <div className="text-[#3DA9E0] font-medium">
                    {memberPrice} <span className="text-sm">(Member Price)</span>
                  </div>
                </div>
              ) : (
                <div className="text-gray-900 font-medium">{price}</div>
              )}
            </div>
          </div>

          <Button 
            onClick={() => onViewDetails(event)}
            className="w-full bg-linear-to-r from-[#3DA9E0] to-[#001731] hover:from-[#3DA9E0]/90 hover:to-[#001731]/90 text-white border-0"
          >
            {eventData?.is_collection ? 'View Collection' : 'View Details'}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </Card>
    </motion.div>
  )
}

