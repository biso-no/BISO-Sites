'use client'

import { motion } from 'motion/react'
import { Users, DollarSign, Heart, ArrowRight } from 'lucide-react'
import { Card } from '@repo/ui/components/ui/card'
import { Button } from '@repo/ui/components/ui/button'
import { Badge } from '@repo/ui/components/ui/badge'
import type { ContentTranslations } from '@repo/api/types/appwrite'

interface JobCardProps {
  job: ContentTranslations
  index: number
  onViewDetails: (job: ContentTranslations) => void
}

const getJobCategory = (metadata: Record<string, any>) => {
  return metadata.category || 'General'
}

const formatSalary = (salary: number) => {
  return salary.toLocaleString('no-NO', { style: 'currency', currency: 'NOK' })
}

const categoryColors: Record<string, string> = {
  'Academic Associations': 'bg-blue-100 text-blue-700 border-blue-200',
  'Societies': 'bg-[#3DA9E0]/10 text-[#001731] border-[#3DA9E0]/20',
  'Staff Functions': 'bg-slate-100 text-slate-700 border-slate-200',
  'Projects': 'bg-purple-100 text-purple-700 border-purple-200',
}

export function JobCard({ job, index, onViewDetails }: JobCardProps) {
  const jobData = job.job_ref
  const metadata = jobData?.metadata as Record<string, any>
  const category = getJobCategory(metadata)
  
  const paid = metadata.paid ?? false
  const salary = formatSalary(metadata.salary)
  const openings = metadata.openings || 1
  const responsibilities = metadata.responsibilities || []
  const requirements = metadata.requirements || []
  const deadline = metadata.deadline || 'Rolling basis'
  const department = jobData?.department?.Name || 'General'
  
  // Use short_description if available, otherwise truncate description
  const shortDescription = job.short_description || 
    (job.description.length > 150 ? `${job.description.substring(0, 150)}...` : job.description)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card className="overflow-hidden border-0 shadow-lg hover:shadow-2xl transition-all duration-300 group h-full flex flex-col">
        {/* Header */}
        <div className="relative bg-linear-to-br from-[#001731] to-[#3DA9E0] p-6 text-white">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <Badge className={`mb-3 ${categoryColors[category]}`}>
                {category}
              </Badge>
              <h3 className="text-white mb-2 text-xl font-bold">{job.title}</h3>
              <p className="text-white/80 text-sm">{department}</p>
            </div>
            {paid && (
              <div className="flex items-center gap-1 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                <DollarSign className="w-4 h-4" />
                Paid
              </div>
            )}
          </div>

          <div className="flex items-center gap-4 text-white/80 text-sm">
            <div className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              <span>{openings} {openings === 1 ? 'opening' : 'openings'}</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col grow">
          <p className="text-gray-600 mb-4">{shortDescription}</p>

          {paid && salary && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
              <div className="flex items-center gap-2 text-green-700">
                <DollarSign className="w-5 h-5" />
                <span className="font-semibold">Salary: {salary}</span>
              </div>
            </div>
          )}

          {!paid && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <div className="flex items-center gap-2 text-blue-700">
                <Heart className="w-5 h-5" />
                <span className="font-semibold">Volunteer Position</span>
              </div>
            </div>
          )}

          <div className="space-y-4 mb-4 grow">
            {responsibilities.length > 0 && (
              <div>
                <h4 className="text-sm text-gray-900 mb-2 font-semibold">Responsibilities</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  {responsibilities.slice(0, 3).map((resp: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-[#3DA9E0] mt-1">•</span>
                      <span>{resp}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {requirements.length > 0 && (
              <div>
                <h4 className="text-sm text-gray-900 mb-2 font-semibold">Requirements</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  {requirements.slice(0, 3).map((req: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-[#3DA9E0] mt-1">•</span>
                      <span>{req}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="border-t border-gray-100 pt-4 mt-auto">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-500">Application Deadline</span>
              <span className="text-sm text-[#001731] font-medium">{deadline}</span>
            </div>
            <Button 
              onClick={() => onViewDetails(job)}
              className="w-full bg-linear-to-r from-[#3DA9E0] to-[#001731] hover:from-[#3DA9E0]/90 hover:to-[#001731]/90 text-white border-0"
            >
              View Details
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </Card>
    </motion.div>
  )
}

