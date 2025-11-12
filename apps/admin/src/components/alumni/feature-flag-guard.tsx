"use client"

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@repo/ui/components/ui/card'
import { Button } from '@repo/ui/components/ui/button'

interface FeatureFlagGuardProps {
  children: React.ReactNode
  featureEnabled: boolean
  featureName: string
  redirectTo?: string
}

export function FeatureFlagGuard({
  children,
  featureEnabled,
  featureName,
  redirectTo = "/alumni"
}: FeatureFlagGuardProps) {
  const router = useRouter()
  const [isClient, setIsClient] = useState(false)
  
  // Ensure the component only runs on the client
  useEffect(() => {
    setIsClient(true)
  }, [])
  
  // If not on the client yet, show nothing to prevent hydration mismatch
  if (!isClient) {
    return null
  }
  
  // If the feature is enabled, render the children
  if (featureEnabled) {
    return <>{children}</>
  }
  
  // If the feature is not enabled, render a message
  return (
    <div className="w-full flex justify-center items-center min-h-[50vh]">
      <Card className="max-w-lg p-6 text-center space-y-4 bg-primary-80/60 backdrop-blur-md border border-secondary-100/10">
        <h2 className="text-xl font-semibold text-white">Feature Not Available</h2>
        <p className="text-gray-300">
          The {featureName} feature is currently not available.
        </p>
        <Button onClick={() => router.push(redirectTo)} className="mt-4">
          Go Back
        </Button>
      </Card>
    </div>
  )
} 