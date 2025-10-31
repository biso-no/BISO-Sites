import { Loader2 } from 'lucide-react'

interface LoadingPageProps {
  message?: string
}

export default function LoadingPage({ message = "Loading tickets..." }: LoadingPageProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
      <div className="text-center">
        <Loader2 className="w-16 h-16 animate-spin text-primary mx-auto mb-4" aria-hidden="true" />
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          {message}
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Please wait while we retrieve your information.
        </p>
      </div>
    </div>
  )
}

