'use client'

import { motion } from 'motion/react'
import { ChevronDown } from 'lucide-react'
import { ImageWithFallback } from '@repo/ui/components/image'

export function EventsHero() {
  return (
    <div className="relative h-[50vh] overflow-hidden">
      <ImageWithFallback
        src="https://images.unsplash.com/photo-1758270705657-f28eec1a5694?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjYW1wdXMlMjBsaWZlJTIwZW5lcmd5fGVufDF8fHx8MTc2MjE2NTE0NHww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
        alt="Events"
        className="w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-br from-[#001731]/95 via-[#3DA9E0]/70 to-[#001731]/90" />
      
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h1 className="mb-6 text-white text-5xl md:text-6xl font-bold">
              Discover Amazing
              <br />
              <span className="bg-gradient-to-r from-[#3DA9E0] via-cyan-300 to-blue-300 bg-clip-text text-transparent">
                Events & Experiences
              </span>
            </h1>
            <p className="text-white/90 text-lg max-w-2xl mx-auto">
              From networking events to social gatherings, find the perfect opportunity to connect, learn, and create unforgettable memories.
            </p>
          </motion.div>
        </div>
      </div>

      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <ChevronDown className="w-8 h-8 text-white/70" />
      </motion.div>
    </div>
  )
}

