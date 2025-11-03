'use client';
import { motion } from 'motion/react';
import { Calendar, MapPin, Clock, ArrowRight, Users } from 'lucide-react';
import { Card } from '@repo/ui/components/ui/card';
import { Button } from '@repo/ui/components/ui/button';
import { Badge } from '@repo/ui/components/ui/badge';
import { ImageWithFallback } from '@repo/ui/components/image';

export function Events() {
  const events = [
    {
      id: 1,
      title: 'Welcome Week 2024',
      date: 'November 18-22, 2024',
      time: '09:00 - 22:00',
      location: 'BI Campus Oslo',
      category: 'Social',
      attendees: 450,
      image: 'https://images.unsplash.com/photo-1758270705657-f28eec1a5694?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjYW1wdXMlMjBsaWZlJTIwZW5lcmd5fGVufDF8fHx8MTc2MjE2NTE0NHww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
      featured: true,
    },
    {
      id: 2,
      title: 'Business Networking Night',
      date: 'November 25, 2024',
      time: '18:00 - 22:00',
      location: 'Downtown Oslo',
      category: 'Career',
      attendees: 120,
      image: 'https://images.unsplash.com/photo-1550305080-4e029753abcf?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzdHVkZW50JTIwbmV0d29ya2luZyUyMGV2ZW50fGVufDF8fHx8MTc2MjE1NDAxMXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
      featured: false,
    },
    {
      id: 3,
      title: 'Winter Gala 2024',
      date: 'December 14, 2024',
      time: '19:00 - 02:00',
      location: 'Grand Hotel Oslo',
      category: 'Social',
      attendees: 300,
      image: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzdHVkZW50JTIwZXZlbnQlMjBwYXJ0eXxlbnwxfHx8fDE3NjIxNjUxNDR8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
      featured: true,
    },
    {
      id: 4,
      title: 'Study & Chill Session',
      date: 'November 28, 2024',
      time: '14:00 - 18:00',
      location: 'Library Building',
      category: 'Academic',
      attendees: 80,
      image: 'https://images.unsplash.com/photo-1760351065294-b069f6bcadc4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzdHVkZW50cyUyMHN0dWR5aW5nJTIwdG9nZXRoZXJ8ZW58MXx8fHwxNzYyMDczMzQ0fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
      featured: false,
    },
  ];

  const categoryColors: Record<string, string> = {
    Social: 'bg-[#3DA9E0]/10 text-[#001731] border-[#3DA9E0]/20',
    Career: 'bg-[#001731]/10 text-[#001731] border-[#001731]/20',
    Academic: 'bg-cyan-100 text-[#001731] border-cyan-200',
  };

  return (
    <section id="events" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <div className="inline-block px-4 py-2 rounded-full bg-[#3DA9E0]/10 text-[#001731] mb-6">
            Upcoming Events
          </div>
          <h2 className="mb-6 text-gray-900">
            Don't Miss Out on
            <br />
            <span className="bg-gradient-to-r from-[#3DA9E0] to-[#001731] bg-clip-text text-transparent">
              Amazing Experiences
            </span>
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            From networking events to unforgettable parties, we've got your semester covered with 
            exciting activities and opportunities.
          </p>
        </motion.div>

        {/* Events Grid */}
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {events.map((event, index) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className={event.featured ? 'md:col-span-2' : ''}
            >
              <Card className="overflow-hidden border-0 shadow-lg hover:shadow-2xl transition-all duration-300 group">
                <div className={`grid ${event.featured ? 'md:grid-cols-2' : ''} gap-0`}>
                  {/* Image */}
                  <div className={`relative overflow-hidden ${event.featured ? 'h-96 md:h-auto' : 'h-64'}`}>
                    <ImageWithFallback
                      src={event.image}
                      alt={event.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    <Badge className={`absolute top-4 left-4 ${categoryColors[event.category]}`}>
                      {event.category}
                    </Badge>
                  </div>

                  {/* Content */}
                  <div className="p-8 flex flex-col justify-between">
                    <div>
                      <h3 className="mb-4 text-gray-900">{event.title}</h3>
                      
                      <div className="space-y-3 mb-6">
                        <div className="flex items-center gap-3 text-gray-600">
                          <Calendar className="w-5 h-5 text-[#3DA9E0]" />
                          <span>{event.date}</span>
                        </div>
                        <div className="flex items-center gap-3 text-gray-600">
                          <Clock className="w-5 h-5 text-[#3DA9E0]" />
                          <span>{event.time}</span>
                        </div>
                        <div className="flex items-center gap-3 text-gray-600">
                          <MapPin className="w-5 h-5 text-[#3DA9E0]" />
                          <span>{event.location}</span>
                        </div>
                        <div className="flex items-center gap-3 text-gray-600">
                          <Users className="w-5 h-5 text-[#3DA9E0]" />
                          <span>{event.attendees} attending</span>
                        </div>
                      </div>
                    </div>

                    <Button className="w-full bg-gradient-to-r from-[#3DA9E0] to-[#001731] hover:from-[#3DA9E0]/90 hover:to-[#001731]/90 text-white border-0 group">
                      Register Now
                      <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* View All Button */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <Button variant="outline" size="lg" className="border-[#3DA9E0] text-[#001731] hover:bg-[#3DA9E0]/10">
            View All Events
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
