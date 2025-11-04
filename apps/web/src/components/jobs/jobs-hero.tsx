'use client'

import { motion } from 'motion/react'
import { ChevronDown, Heart } from 'lucide-react'
import { ImageWithFallback } from '@repo/ui/components/image'

interface JobsHeroProps {
  totalPositions: number
  paidPositions: number
  departmentCount: number
}

export function JobsHero({ totalPositions, paidPositions, departmentCount }: JobsHeroProps) {
  return (
    <div className="relative h-[60vh] overflow-hidden">
      <ImageWithFallback
        src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0ZWFtJTIwd29ya2luZ3xlbnwxfHx8fDE3NjIxNjUxNDV8MA&ixlib=rb-4.1.0&q=80&w=1080"
        alt="Join the team"
        className="w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-linear-to-br from-[#001731]/95 via-[#3DA9E0]/70 to-[#001731]/90" />
      
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="inline-flex items-center gap-3 bg-white/10 backdrop-blur-sm px-6 py-3 rounded-full mb-6 border border-white/20">
              <Heart className="w-5 h-5 text-[#3DA9E0]" />
              <span className="text-white">Join Our Team</span>
            </div>
            <h1 className="mb-6 text-white text-5xl md:text-6xl font-bold">
              Make a Difference
              <br />
              <span className="bg-linear-to-r from-[#3DA9E0] via-cyan-300 to-blue-300 bg-clip-text text-transparent">
                Shape Student Life
              </span>
            </h1>
            <p className="text-white/90 max-w-2xl mx-auto text-lg">
              Join BISO and be part of creating exceptional experiences for thousands of students. Find your perfect role and make an impact.
            </p>

            <div className="flex items-center justify-center gap-8 mt-8">
              <div className="text-center">
                <div className="text-3xl text-white mb-1 font-bold">{totalPositions}</div>
                <div className="text-white/80 text-sm">Open Positions</div>
              </div>
              <div className="w-px h-12 bg-white/20" />
              <div className="text-center">
                <div className="text-3xl text-white mb-1 font-bold">{paidPositions}</div>
                <div className="text-white/80 text-sm">Paid Roles</div>
              </div>
              <div className="w-px h-12 bg-white/20" />
              <div className="text-center">
                <div className="text-3xl text-white mb-1 font-bold">{departmentCount}</div>
                <div className="text-white/80 text-sm">Departments</div>
              </div>
            </div>
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

