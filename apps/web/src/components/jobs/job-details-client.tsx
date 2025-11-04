'use client'

import { motion } from 'motion/react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Clock, Users, DollarSign, Heart, Calendar, CheckCircle2, AlertCircle, Mail, Send } from 'lucide-react'
import { Card } from '@repo/ui/components/ui/card'
import { Button } from '@repo/ui/components/ui/button'
import { Badge } from '@repo/ui/components/ui/badge'
import { Separator } from '@repo/ui/components/ui/separator'
import { ImageWithFallback } from '@repo/ui/components/image'
import type { ContentTranslations } from '@repo/api/types/appwrite'
import { parseJobMetadata, getJobCategory, formatSalary, type JobCategory } from '@/lib/types/job'

interface JobDetailsClientProps {
  job: ContentTranslations
}

const categoryColors: Record<JobCategory, string> = {
  'Academic Associations': 'bg-blue-100 text-blue-700 border-blue-200',
  'Societies': 'bg-[#3DA9E0]/10 text-[#001731] border-[#3DA9E0]/20',
  'Staff Functions': 'bg-slate-100 text-slate-700 border-slate-200',
  'Projects': 'bg-purple-100 text-purple-700 border-purple-200',
}

const categoryImages: Record<JobCategory, string> = {
  'Academic Associations': 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=1080',
  'Societies': 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=1080',
  'Staff Functions': 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=1080',
  'Projects': 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=1080',
}

export function JobDetailsClient({ job }: JobDetailsClientProps) {
  const router = useRouter()
  const jobData = job.job_ref
  const metadata = parseJobMetadata(jobData?.metadata)
  const category = getJobCategory(metadata)
  
  // Extract data
  const paid = metadata.paid ?? false
  const salary = formatSalary(metadata.salary)
  const openings = metadata.openings || 1
  const responsibilities = metadata.responsibilities || []
  const requirements = metadata.requirements || []
  const deadline = metadata.deadline || 'Rolling basis'
  const department = jobData?.department?.name || 'General'
  const categoryImage = metadata.image || categoryImages[category]

  // Extended information
  const extendedResponsibilities = [
    ...responsibilities,
    'Collaborate with other BISO team members',
    'Attend regular team meetings and planning sessions',
    'Contribute to strategic planning and decision-making',
  ]

  const extendedRequirements = [
    ...requirements,
    'Passion for improving student life',
    'Team player with excellent interpersonal skills',
    'Ability to work independently and take initiative',
  ]

  const benefits = [
    ...(paid ? ['Competitive compensation package'] : []),
    'Gain valuable leadership and organizational experience',
    'Build an extensive professional network',
    'Access to exclusive BISO events and activities',
    'Professional development workshops and training',
    'Certificate of participation for your CV',
    'Letter of recommendation upon successful completion',
  ]

  const timeline = {
    application: 'Applications reviewed on a rolling basis',
    interviews: 'Interviews scheduled within 1 week of application',
    decision: 'Final decisions communicated within 2 weeks',
    start: 'Position starts immediately after acceptance',
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-gray-50 to-white">
      {/* Hero Section */}
      <div className="relative h-[40vh] overflow-hidden">
        <ImageWithFallback
          src={categoryImage}
          alt={category}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-linear-to-br from-[#001731]/95 via-[#3DA9E0]/70 to-[#001731]/90" />
        
        <div className="absolute inset-0">
          <div className="max-w-5xl mx-auto px-4 h-full flex items-center">
            <motion.button
              onClick={() => router.push('/jobs')}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="absolute top-8 left-8 flex items-center gap-2 text-white hover:text-[#3DA9E0] transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Positions
            </motion.button>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-12"
            >
              <Badge className={`mb-4 ${categoryColors[category]}`}>
                {category}
              </Badge>
              <h1 className="text-white mb-4 text-4xl md:text-5xl font-bold">{job.title}</h1>
              <p className="text-white/90 text-xl">{department}</p>

              <div className="flex flex-wrap items-center gap-4 mt-6">
                <div className="flex items-center gap-2 text-white/90">
                  <Users className="w-5 h-5 text-[#3DA9E0]" />
                  <span>{openings} {openings === 1 ? 'opening' : 'openings'}</span>
                </div>
                <div className="flex items-center gap-2 text-white/90">
                  <Calendar className="w-5 h-5 text-[#3DA9E0]" />
                  <span>Deadline: {deadline}</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Overview */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="p-8 border-0 shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                  <div className="px-3 py-1 bg-[#3DA9E0]/10 rounded-lg">
                    <span className="text-sm text-[#001731]">{department}</span>
                  </div>
                </div>
                <h2 className="text-gray-900 mb-4 text-2xl font-bold">Position Overview</h2>
                <p className="text-gray-700 leading-relaxed whitespace-pre-line">{job.description}</p>
              </Card>
            </motion.div>

            {/* What You'll Do */}
            {extendedResponsibilities.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Card className="p-8 border-0 shadow-lg">
                  <h2 className="text-gray-900 mb-6 text-2xl font-bold">What You'll Do</h2>
                  <ul className="space-y-4">
                    {extendedResponsibilities.map((item, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-[#3DA9E0] flex-shrink-0 mt-1" />
                        <span className="text-gray-700">{item}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              </motion.div>
            )}

            {/* What We're Looking For */}
            {extendedRequirements.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Card className="p-8 border-0 shadow-lg">
                  <h2 className="text-gray-900 mb-6 text-2xl font-bold">What We're Looking For</h2>
                  <ul className="space-y-4">
                    {extendedRequirements.map((item, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-[#3DA9E0] flex-shrink-0 mt-1" />
                        <span className="text-gray-700">{item}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              </motion.div>
            )}

            {/* Benefits */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card className="p-8 border-0 shadow-lg bg-linear-to-br from-[#3DA9E0]/5 to-[#001731]/5">
                <h2 className="text-gray-900 mb-6 text-2xl font-bold">What You'll Gain</h2>
                <ul className="space-y-4">
                  {benefits.map((item, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-[#3DA9E0] flex-shrink-0 mt-1" />
                      <span className="text-gray-700">{item}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </motion.div>

            {/* Application Timeline */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <Card className="p-8 border-0 shadow-lg">
                <h2 className="text-gray-900 mb-6 text-2xl font-bold">Application Process</h2>
                <div className="space-y-6">
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-linear-to-r from-[#3DA9E0] to-[#001731] flex items-center justify-center text-white font-bold">
                      1
                    </div>
                    <div>
                      <h3 className="mb-2 font-semibold">Submit Application</h3>
                      <p className="text-gray-600">{timeline.application}</p>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-linear-to-r from-[#3DA9E0] to-[#001731] flex items-center justify-center text-white font-bold">
                      2
                    </div>
                    <div>
                      <h3 className="mb-2 font-semibold">Interview</h3>
                      <p className="text-gray-600">{timeline.interviews}</p>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-linear-to-r from-[#3DA9E0] to-[#001731] flex items-center justify-center text-white font-bold">
                      3
                    </div>
                    <div>
                      <h3 className="mb-2 font-semibold">Decision</h3>
                      <p className="text-gray-600">{timeline.decision}</p>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-linear-to-r from-[#3DA9E0] to-[#001731] flex items-center justify-center text-white font-bold">
                      4
                    </div>
                    <div>
                      <h3 className="mb-2 font-semibold">Get Started</h3>
                      <p className="text-gray-600">{timeline.start}</p>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Compensation Card */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              {paid && salary ? (
                <Card className="p-6 border-0 shadow-lg bg-linear-to-br from-green-50 to-emerald-50">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center">
                      <DollarSign className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Compensation</div>
                      <div className="text-gray-900 font-bold">{salary}</div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600">This is a paid position with competitive compensation.</p>
                </Card>
              ) : (
                <Card className="p-6 border-0 shadow-lg bg-linear-to-br from-blue-50 to-cyan-50">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-[#3DA9E0] flex items-center justify-center">
                      <Heart className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Position Type</div>
                      <div className="text-gray-900 font-bold">Volunteer</div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600">Make an impact while gaining valuable experience and connections.</p>
                </Card>
              )}
            </motion.div>

            {/* Key Details */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="p-6 border-0 shadow-lg">
                <h3 className="mb-4 text-gray-900 font-bold">Key Details</h3>
                <div className="space-y-4">
                  <div>
                    <div className="text-sm text-gray-500 mb-1">Department</div>
                    <div className="text-gray-900">{department}</div>
                  </div>
                  <Separator />
                  <div>
                    <div className="text-sm text-gray-500 mb-1">Category</div>
                    <div className="text-gray-900">{category}</div>
                  </div>
                  <Separator />
                  <div>
                    <div className="text-sm text-gray-500 mb-1">Openings</div>
                    <div className="text-gray-900">{openings} {openings === 1 ? 'position' : 'positions'} available</div>
                  </div>
                  <Separator />
                  <div>
                    <div className="text-sm text-gray-500 mb-1">Application Deadline</div>
                    <div className="text-gray-900">{deadline}</div>
                  </div>
                </div>
              </Card>
            </motion.div>

            {/* Apply Card */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card className="p-6 border-0 shadow-lg bg-linear-to-br from-[#001731] to-[#3DA9E0]">
                <h3 className="mb-4 text-white font-bold">Ready to Apply?</h3>
                <p className="text-white/90 text-sm mb-6">
                  Submit your application and join our team in creating amazing experiences for students.
                </p>
                <Button className="w-full bg-white text-[#001731] hover:bg-white/90 mb-3">
                  <Send className="w-4 h-4 mr-2" />
                  Submit Application
                </Button>
                <Button variant="outline" className="w-full border-white text-white hover:bg-white/10">
                  <Mail className="w-4 h-4 mr-2" />
                  Ask a Question
                </Button>
              </Card>
            </motion.div>

            {/* Contact Info */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
            >
              <Card className="p-6 border-0 shadow-lg bg-blue-50">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="mb-2 text-gray-900 font-semibold">Questions?</h4>
                    <p className="text-sm text-gray-600">
                      Contact our recruitment team at{' '}
                      <a href="mailto:recruitment@biso.no" className="text-[#3DA9E0] hover:underline">
                        recruitment@biso.no
                      </a>
                    </p>
                  </div>
                </div>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}

