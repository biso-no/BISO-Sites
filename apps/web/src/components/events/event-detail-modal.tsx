'use client'

import { motion, AnimatePresence } from 'motion/react'
import { X, Calendar, MapPin, Clock, Users, ExternalLink, Tag } from 'lucide-react'
import { Button } from '@repo/ui/components/ui/button'
import { Badge } from '@repo/ui/components/ui/badge'
import { ImageWithFallback } from '@repo/ui/components/image'
import type { ContentTranslations } from '@repo/api/types/appwrite'
import { format } from 'date-fns'
import { parseEventMetadata, formatEventPrice, getEventCategory, type EventCategory } from '@/lib/types/event'

interface EventDetailModalProps {
  event: ContentTranslations
  isMember?: boolean
  onClose: () => void
}

const categoryColors: Record<EventCategory, string> = {
  Social: 'bg-purple-100 text-purple-700 border-purple-200',
  Career: 'bg-blue-100 text-blue-700 border-blue-200',
  Academic: 'bg-green-100 text-green-700 border-green-200',
  Sports: 'bg-orange-100 text-orange-700 border-orange-200',
  Culture: 'bg-pink-100 text-pink-700 border-pink-200',
}

export function EventDetailModal({ event, isMember = false, onClose }: EventDetailModalProps) {
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
  
  // Get attendees and other metadata
  const attendees = metadata.attendees || 0
  const highlights = metadata.highlights || []
  const agenda = metadata.agenda || []
  
  // Get image URL
  const imageUrl = eventData?.image || 'https://images.unsplash.com/photo-1758270705657-f28eec1a5694'

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header Image */}
          <div className="relative h-80 overflow-hidden rounded-t-2xl">
            <ImageWithFallback
              src={imageUrl}
              alt={event.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
            
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/90 hover:bg-white transition-colors"
            >
              <X className="w-6 h-6 text-gray-900" />
            </button>

            {/* Category Badge */}
            <div className="absolute top-4 left-4 flex gap-2">
              <Badge className={`${categoryColors[category] || categoryColors.Social}`}>
                {category}
              </Badge>
              {memberPrice && !isMember && (
                <Badge className="bg-green-500 text-white border-0 flex items-center gap-1">
                  <Tag className="w-3 h-3" />
                  Member Discount
                </Badge>
              )}
            </div>

            {/* Title and Price */}
            <div className="absolute bottom-0 left-0 right-0 p-8">
              <div className="flex justify-between items-end">
                <div className="flex-1">
                  <h2 className="text-white text-4xl font-bold mb-2">{event.title}</h2>
                </div>
                <div className="ml-4">
                  {memberPrice && isMember ? (
                    <div className="text-right">
                      <div className="text-white/60 line-through text-sm">{price}</div>
                      <div className="text-white text-2xl font-bold">
                        {memberPrice}
                      </div>
                      <div className="text-white/80 text-xs">Member Price</div>
                    </div>
                  ) : (
                    <div className="text-white text-2xl font-bold">{price}</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-8">
            {/* Event Details */}
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-[#3DA9E0] mt-1" />
                  <div>
                    <div className="font-medium text-gray-900">Date</div>
                    <div className="text-gray-600">{startDate}</div>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-[#3DA9E0] mt-1" />
                  <div>
                    <div className="font-medium text-gray-900">Time</div>
                    <div className="text-gray-600">{timeRange}</div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-[#3DA9E0] mt-1" />
                  <div>
                    <div className="font-medium text-gray-900">Location</div>
                    <div className="text-gray-600">{eventData?.location || 'Location TBA'}</div>
                  </div>
                </div>
                
                {attendees > 0 && (
                  <div className="flex items-start gap-3">
                    <Users className="w-5 h-5 text-[#3DA9E0] mt-1" />
                    <div>
                      <div className="font-medium text-gray-900">Attendees</div>
                      <div className="text-gray-600">{attendees} attending</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Member Price Info */}
            {memberPrice && !isMember && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 text-green-800">
                  <Tag className="w-4 h-4" />
                  <span className="font-medium">
                    Members get this event for {memberPrice}! Join BISO to save.
                  </span>
                </div>
              </div>
            )}

            {/* Description */}
            <div className="mb-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">About This Event</h3>
              <div className="prose prose-gray max-w-none">
                <p className="text-gray-600 whitespace-pre-line">{event.description}</p>
              </div>
            </div>

            {/* Highlights */}
            {highlights.length > 0 && (
              <div className="mb-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-4">Event Highlights</h3>
                <ul className="grid md:grid-cols-2 gap-3">
                  {highlights.map((highlight: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#3DA9E0] mt-2 flex-shrink-0" />
                      <span className="text-gray-600">{highlight}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Agenda */}
            {agenda.length > 0 && (
              <div className="mb-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-4">Agenda</h3>
                <div className="space-y-4">
                  {agenda.map((item: { time: string; activity: string }, idx: number) => (
                    <div key={idx} className="flex gap-4">
                      <div className="flex-shrink-0 w-20">
                        <Badge variant="outline" className="border-[#3DA9E0] text-[#3DA9E0]">
                          {item.time}
                        </Badge>
                      </div>
                      <div className="text-gray-600">{item.activity}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4">
              {eventData?.ticket_url ? (
                <Button
                  onClick={() => window.open(eventData.ticket_url!, '_blank')}
                  className="flex-1 bg-linear-to-r from-[#3DA9E0] to-[#001731] hover:from-[#3DA9E0]/90 hover:to-[#001731]/90 text-white border-0"
                >
                  Get Tickets on Tickster
                  <ExternalLink className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button
                  className="flex-1 bg-linear-to-r from-[#3DA9E0] to-[#001731] hover:from-[#3DA9E0]/90 hover:to-[#001731]/90 text-white border-0"
                >
                  Register Now
                </Button>
              )}
              <Button
                onClick={onClose}
                variant="outline"
                className="border-[#3DA9E0] text-[#001731] hover:bg-[#3DA9E0]/10"
              >
                Close
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

