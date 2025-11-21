'use client'

import { useTranslations } from 'next-intl'
import { motion } from 'motion/react'
import { Building2, ArrowLeft, AlertCircle, Link as LinkIcon } from 'lucide-react'
import Link from 'next/link'
import { Card } from '@repo/ui/components/ui/card'
import { Button } from '@repo/ui/components/ui/button'
import { Alert, AlertDescription } from '@repo/ui/components/ui/alert'

export function NoBIEmailState() {
  const t = useTranslations('memberPortal')

  const handleLinkBIEmail = () => {
    // Redirect to BI OAuth flow
    // This will be implemented with your OAuth provider
    window.location.href = '/api/auth/oauth/bi'
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full"
      >
        <Card className="p-8 border-0 shadow-xl dark:bg-gray-900/50 dark:backdrop-blur-sm">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-linear-to-br from-[#3DA9E0] to-[#001731] flex items-center justify-center">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4 text-center">
            {t('states.noBIEmail.title')}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6 text-center">
            {t('states.noBIEmail.description')}
          </p>
          
          <Alert className="mb-6 border-[#3DA9E0]/20 bg-[#3DA9E0]/5 dark:bg-[#3DA9E0]/10 dark:border-[#3DA9E0]/30">
            <AlertCircle className="h-4 w-4 text-[#3DA9E0]" />
            <AlertDescription className="text-gray-700 dark:text-gray-300">
              {t('states.noBIEmail.securityNote')}
            </AlertDescription>
          </Alert>

          <Button 
            className="w-full bg-linear-to-r from-[#3DA9E0] to-[#001731] hover:from-[#3DA9E0]/90 hover:to-[#001731]/90 text-white mb-4"
            onClick={handleLinkBIEmail}
          >
            <LinkIcon className="w-4 h-4 mr-2" />
            {t('states.noBIEmail.linkEmail')}
          </Button>
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
