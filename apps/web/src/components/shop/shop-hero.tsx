'use client'

import { motion } from 'motion/react'
import { ChevronDown, ShoppingBag, Sparkles, Users } from 'lucide-react'
import { ImageWithFallback } from '@repo/ui/components/image'
import { Badge } from '@repo/ui/components/ui/badge'

interface ShopHeroProps {
  isMember?: boolean
}

export function ShopHero({ isMember = false }: ShopHeroProps) {
  return (
    <div className="relative h-[50vh] overflow-hidden">
            <ImageWithFallback
              src="/images/logo-home.png"
              alt="BISO logo"
              width={140}               // pick the intrinsic pixel width
              height={40}               // and height that matches your asset ratio
              sizes="(max-width: 768px) 120px, 140px"
              priority                   // above-the-fold
              className="h-10 w-auto"    // control display size via CSS
            />
      <div className="absolute inset-0 bg-linear-to-br from-[#001731]/95 via-[#3DA9E0]/70 to-[#001731]/90" />
      
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="flex items-center justify-center gap-2 mb-4">
              <ShoppingBag className="w-12 h-12 text-[#3DA9E0]" />
            </div>
            <h1 className="mb-6 text-white">
              BISO Shop
              <br />
              <span className="bg-linear-to-r from-[#3DA9E0] via-cyan-300 to-blue-300 bg-clip-text text-transparent">
                Everything You Need
              </span>
            </h1>
            <p className="text-white/90 max-w-2xl mx-auto">
              From exclusive merch to trip deductibles and campus lockers - all available for pickup at BISO office.
            </p>
            
            {!isMember && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="mt-6 inline-block"
              >
                <Badge className="bg-[#3DA9E0] text-white border-0 px-4 py-2 text-base">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Join BISO from just 350 NOK/semester - unlock exclusive discounts!
                </Badge>
              </motion.div>
            )}
            
            {isMember && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="mt-6 inline-block"
              >
                <Badge className="bg-green-500 text-white border-0 px-4 py-2 text-base">
                  <Users className="w-4 h-4 mr-2" />
                  Member prices activated!
                </Badge>
              </motion.div>
            )}
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

