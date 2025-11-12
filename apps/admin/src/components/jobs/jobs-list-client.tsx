'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'motion/react'
import { Search, Filter, X, Briefcase, BookOpen, PartyPopper, Cog, Rocket, DollarSign } from 'lucide-react'
import { Button } from '@repo/ui/components/ui/button'
import { Input } from '@repo/ui/components/ui/input'
import { JobCard } from './job-card'
import type { ContentTranslations } from '@repo/api/types/appwrite'

interface JobsListClientProps {
  jobs: ContentTranslations[]
}

const getJobCategory = (metadata: Record<string, any>) => {
  return metadata.category || 'General'
}

const parseJobMetadata = (metadata: Record<string, any>) => {
  return metadata || {}
}

const categories = [
  { name: 'All', icon: Briefcase, color: 'from-[#3DA9E0] to-[#001731]' },
  { name: 'Academic Associations', icon: BookOpen, color: 'from-blue-500 to-indigo-600' },
  { name: 'Societies', icon: PartyPopper, color: 'from-[#3DA9E0] to-cyan-500' },
  { name: 'Staff Functions', icon: Cog, color: 'from-[#001731] to-slate-700' },
  { name: 'Projects', icon: Rocket, color: 'from-purple-500 to-pink-500' },
]

export function JobsListClient({ jobs }: JobsListClientProps) {
  const router = useRouter()
  const [selectedCategory, setSelectedCategory] = useState<string>('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [showPaidOnly, setShowPaidOnly] = useState(false)

  // Filter jobs based on search, category, and paid status
  const filteredJobs = jobs.filter((job) => {
    const jobData = job.job_ref
    const metadata = jobData?.metadata as Record<string, any>
    const category = getJobCategory(metadata)
    const paid = metadata.paid ?? false
    const department = jobData?.department?.Name || ''
    
    const matchesCategory = selectedCategory === 'All' || category === selectedCategory
    const matchesSearch =
      job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (job.short_description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      department.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesPaid = !showPaidOnly || paid
    
    return matchesCategory && matchesSearch && matchesPaid
  })

  const handleViewDetails = (job: ContentTranslations) => {
    // Use slug if available, otherwise fall back to content_id
    const slug = job.job_ref?.slug || job.content_id
    router.push(`/jobs/${slug}`)
  }

  return (
    <>
      {/* Filters & Search */}
      <div className="sticky top-20 z-40 bg-white/95 backdrop-blur-lg shadow-lg border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col gap-4">
            {/* Search */}
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                type="text"
                placeholder="Search positions by title, department, or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-10 w-full border-[#3DA9E0]/20 focus:border-[#3DA9E0]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Category Filter */}
            <div className="flex items-center gap-3 flex-wrap">
              <Filter className="w-5 h-5 text-[#001731]" />
              {categories.map((category) => {
                const Icon = category.icon
                return (
                  <Button
                    key={category.name}
                    onClick={() => setSelectedCategory(category.name)}
                    variant={selectedCategory === category.name ? 'default' : 'outline'}
                    className={
                      selectedCategory === category.name
                        ? `bg-linear-to-r ${category.color} text-white border-0`
                        : 'border-[#3DA9E0]/20 text-[#001731] hover:bg-[#3DA9E0]/10'
                    }
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    {category.name}
                  </Button>
                )
              })}
              
              {/* Paid Filter */}
              <div className="ml-auto flex items-center gap-2">
                <Button
                  onClick={() => setShowPaidOnly(!showPaidOnly)}
                  variant={showPaidOnly ? 'default' : 'outline'}
                  className={
                    showPaidOnly
                      ? 'bg-linear-to-r from-green-500 to-emerald-600 text-white border-0'
                      : 'border-green-500/20 text-green-700 hover:bg-green-50'
                  }
                >
                  <DollarSign className="w-4 h-4 mr-2" />
                  Paid Positions Only
                </Button>
              </div>
            </div>

            <div className="text-center text-gray-600 text-sm">
              Showing {filteredJobs.length} {filteredJobs.length === 1 ? 'position' : 'positions'}
            </div>
          </div>
        </div>
      </div>

      {/* Positions Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedCategory + searchQuery + showPaidOnly}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid md:grid-cols-2 gap-8"
          >
            {filteredJobs.map((job, index) => (
              <JobCard
                key={job.$id}
                job={job}
                index={index}
                onViewDetails={handleViewDetails}
              />
            ))}
          </motion.div>
        </AnimatePresence>

        {/* No Results */}
        {filteredJobs.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <Briefcase className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="mb-2 text-gray-900 text-2xl font-bold">No positions found</h3>
            <p className="text-gray-600 mb-6">
              Try adjusting your filters or search query
            </p>
            <Button
              onClick={() => {
                setSelectedCategory('All')
                setSearchQuery('')
                setShowPaidOnly(false)
              }}
              variant="outline"
              className="border-[#3DA9E0] text-[#001731] hover:bg-[#3DA9E0]/10"
            >
              Clear All Filters
            </Button>
          </motion.div>
        )}
      </div>

      {/* CTA Section */}
      <div className="bg-linear-to-r from-[#001731] to-[#3DA9E0] py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-white mb-4 text-3xl font-bold">Questions About Applying?</h2>
          <p className="text-white/90 mb-8 text-lg">
            Our recruitment team is here to help! Reach out if you have any questions about positions or the application process.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Button className="bg-white text-[#001731] hover:bg-white/90">
              Contact Recruitment Team
            </Button>
            <Button variant="outline" className="border-white text-white hover:bg-white/10">
              Download Information Pack
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}

