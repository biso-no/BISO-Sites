'use client'

import { useTranslations } from 'next-intl'
import { motion } from 'motion/react'
import { Lock, Mail, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Card } from '@repo/ui/components/ui/card'
import { Button } from '@repo/ui/components/ui/button'

export function SignedOutState() {
  const t = useTranslations('memberPortal')

  return (
    <div className="min-h-screen bg-linear-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full"
      >
        <Card className="p-8 text-center border-0 shadow-xl dark:bg-gray-900/50 dark:backdrop-blur-sm">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-linear-to-br from-[#3DA9E0] to-[#001731] flex items-center justify-center">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            {t('states.signedOut.title')}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {t('states.signedOut.description')}
          </p>
          <Link href="/auth/login">
            <Button className="w-full bg-linear-to-r from-[#3DA9E0] to-[#001731] hover:from-[#3DA9E0]/90 hover:to-[#001731]/90 text-white mb-4">
              <Mail className="w-4 h-4 mr-2" />
              {t('states.signedOut.signIn')}
            </Button>
          </Link>
          <Link href="/">
            <Button variant="outline" className="w-full">
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t('backToHome')}
            </Button>
          </Link>
        </Card>
      </motion.div>
    </div>
  )
}
