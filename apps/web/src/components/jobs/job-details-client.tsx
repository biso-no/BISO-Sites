"use client";

import type { ContentTranslations } from "@repo/api/types/appwrite";
import { ImageWithFallback } from "@repo/ui/components/image";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { Separator } from "@repo/ui/components/ui/separator";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  DollarSign,
  Heart,
  Mail,
  Send,
  Users,
} from "lucide-react";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";

type JobDetailsClientProps = {
  job: ContentTranslations;
};

const getJobCategory = (metadata: Record<string, any>) =>
  metadata.category || "General";

const formatSalary = (salary: number) =>
  salary.toLocaleString("no-NO", { style: "currency", currency: "NOK" });

const _parseJobMetadata = (metadata: Record<string, any>) => metadata || {};

const categoryColors: Record<string, string> = {
  "Academic Associations": "bg-blue-100 text-blue-700 border-blue-200",
  Societies: "bg-[#3DA9E0]/10 text-[#001731] border-[#3DA9E0]/20",
  "Staff Functions": "bg-slate-100 text-slate-700 border-slate-200",
  Projects: "bg-purple-100 text-purple-700 border-purple-200",
};

const categoryImages: Record<string, string> = {
  "Academic Associations":
    "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=1080",
  Societies:
    "https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=1080",
  "Staff Functions":
    "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=1080",
  Projects: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=1080",
};

export function JobDetailsClient({ job }: JobDetailsClientProps) {
  const router = useRouter();
  const jobData = job.job_ref;
  const metadata = jobData?.metadata as Record<string, any>;
  const category = getJobCategory(metadata);

  // Extract data
  const paid = metadata.paid ?? false;
  const salary = formatSalary(metadata.salary);
  const openings = metadata.openings || 1;
  const responsibilities = metadata.responsibilities || [];
  const requirements = metadata.requirements || [];
  const deadline = metadata.deadline || "Rolling basis";
  const department = jobData?.department?.Name || "General";
  const categoryImage = metadata.image || categoryImages[category];

  // Extended information
  const extendedResponsibilities = [
    ...responsibilities,
    "Collaborate with other BISO team members",
    "Attend regular team meetings and planning sessions",
    "Contribute to strategic planning and decision-making",
  ];

  const extendedRequirements = [
    ...requirements,
    "Passion for improving student life",
    "Team player with excellent interpersonal skills",
    "Ability to work independently and take initiative",
  ];

  const benefits = [
    ...(paid ? ["Competitive compensation package"] : []),
    "Gain valuable leadership and organizational experience",
    "Build an extensive professional network",
    "Access to exclusive BISO events and activities",
    "Professional development workshops and training",
    "Certificate of participation for your CV",
    "Letter of recommendation upon successful completion",
  ];

  const timeline = {
    application: "Applications reviewed on a rolling basis",
    interviews: "Interviews scheduled within 1 week of application",
    decision: "Final decisions communicated within 2 weeks",
    start: "Position starts immediately after acceptance",
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-gray-50 to-white">
      {/* Hero Section */}
      <div className="relative h-[40vh] overflow-hidden">
        <ImageWithFallback
          alt={category}
          className="object-cover"
          fill
          src={categoryImage}
        />
        <div className="absolute inset-0 bg-linear-to-br from-[#001731]/95 via-[#3DA9E0]/70 to-[#001731]/90" />

        <div className="absolute inset-0">
          <div className="mx-auto flex h-full max-w-5xl items-center px-4">
            <motion.button
              animate={{ opacity: 1, x: 0 }}
              className="absolute top-8 left-8 flex items-center gap-2 text-white transition-colors hover:text-[#3DA9E0]"
              initial={{ opacity: 0, x: -20 }}
              onClick={() => router.push("/jobs")}
            >
              <ArrowLeft className="h-5 w-5" />
              Back to Positions
            </motion.button>

            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="mt-12"
              initial={{ opacity: 0, y: 20 }}
            >
              <Badge className={`mb-4 ${categoryColors[category]}`}>
                {category}
              </Badge>
              <h1 className="mb-4 font-bold text-4xl text-white md:text-5xl">
                {job.title}
              </h1>
              <p className="text-white/90 text-xl">{department}</p>

              <div className="mt-6 flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2 text-white/90">
                  <Users className="h-5 w-5 text-[#3DA9E0]" />
                  <span>
                    {openings} {openings === 1 ? "opening" : "openings"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-white/90">
                  <Calendar className="h-5 w-5 text-[#3DA9E0]" />
                  <span>Deadline: {deadline}</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main Content */}
          <div className="space-y-8 lg:col-span-2">
            {/* Overview */}
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              initial={{ opacity: 0, y: 20 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="border-0 p-8 shadow-lg">
                <div className="mb-4 flex items-center gap-3">
                  <div className="rounded-lg bg-[#3DA9E0]/10 px-3 py-1">
                    <span className="text-[#001731] text-sm">{department}</span>
                  </div>
                </div>
                <h2 className="mb-4 font-bold text-2xl text-gray-900">
                  Position Overview
                </h2>
                <p className="whitespace-pre-line text-gray-700 leading-relaxed">
                  {job.description}
                </p>
              </Card>
            </motion.div>

            {/* What You'll Do */}
            {extendedResponsibilities.length > 0 && (
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                initial={{ opacity: 0, y: 20 }}
                transition={{ delay: 0.2 }}
              >
                <Card className="border-0 p-8 shadow-lg">
                  <h2 className="mb-6 font-bold text-2xl text-gray-900">
                    What You'll Do
                  </h2>
                  <ul className="space-y-4">
                    {extendedResponsibilities.map((item, index) => (
                      <li className="flex items-start gap-3" key={index}>
                        <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-[#3DA9E0]" />
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
                animate={{ opacity: 1, y: 0 }}
                initial={{ opacity: 0, y: 20 }}
                transition={{ delay: 0.3 }}
              >
                <Card className="border-0 p-8 shadow-lg">
                  <h2 className="mb-6 font-bold text-2xl text-gray-900">
                    What We're Looking For
                  </h2>
                  <ul className="space-y-4">
                    {extendedRequirements.map((item, index) => (
                      <li className="flex items-start gap-3" key={index}>
                        <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-[#3DA9E0]" />
                        <span className="text-gray-700">{item}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              </motion.div>
            )}

            {/* Benefits */}
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              initial={{ opacity: 0, y: 20 }}
              transition={{ delay: 0.4 }}
            >
              <Card className="border-0 bg-linear-to-br from-[#3DA9E0]/5 to-[#001731]/5 p-8 shadow-lg">
                <h2 className="mb-6 font-bold text-2xl text-gray-900">
                  What You'll Gain
                </h2>
                <ul className="space-y-4">
                  {benefits.map((item, index) => (
                    <li className="flex items-start gap-3" key={index}>
                      <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-[#3DA9E0]" />
                      <span className="text-gray-700">{item}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </motion.div>

            {/* Application Timeline */}
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              initial={{ opacity: 0, y: 20 }}
              transition={{ delay: 0.5 }}
            >
              <Card className="border-0 p-8 shadow-lg">
                <h2 className="mb-6 font-bold text-2xl text-gray-900">
                  Application Process
                </h2>
                <div className="space-y-6">
                  <div className="flex gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-linear-to-r from-[#3DA9E0] to-[#001731] font-bold text-white">
                      1
                    </div>
                    <div>
                      <h3 className="mb-2 font-semibold">Submit Application</h3>
                      <p className="text-gray-600">{timeline.application}</p>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-linear-to-r from-[#3DA9E0] to-[#001731] font-bold text-white">
                      2
                    </div>
                    <div>
                      <h3 className="mb-2 font-semibold">Interview</h3>
                      <p className="text-gray-600">{timeline.interviews}</p>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-linear-to-r from-[#3DA9E0] to-[#001731] font-bold text-white">
                      3
                    </div>
                    <div>
                      <h3 className="mb-2 font-semibold">Decision</h3>
                      <p className="text-gray-600">{timeline.decision}</p>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-linear-to-r from-[#3DA9E0] to-[#001731] font-bold text-white">
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
              animate={{ opacity: 1, x: 0 }}
              initial={{ opacity: 0, x: 20 }}
              transition={{ delay: 0.2 }}
            >
              {paid && salary ? (
                <Card className="border-0 bg-linear-to-br from-green-50 to-emerald-50 p-6 shadow-lg">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500">
                      <DollarSign className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <div className="text-gray-600 text-sm">Compensation</div>
                      <div className="font-bold text-gray-900">{salary}</div>
                    </div>
                  </div>
                  <p className="text-gray-600 text-sm">
                    This is a paid position with competitive compensation.
                  </p>
                </Card>
              ) : (
                <Card className="border-0 bg-linear-to-br from-blue-50 to-cyan-50 p-6 shadow-lg">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#3DA9E0]">
                      <Heart className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <div className="text-gray-600 text-sm">Position Type</div>
                      <div className="font-bold text-gray-900">Volunteer</div>
                    </div>
                  </div>
                  <p className="text-gray-600 text-sm">
                    Make an impact while gaining valuable experience and
                    connections.
                  </p>
                </Card>
              )}
            </motion.div>

            {/* Key Details */}
            <motion.div
              animate={{ opacity: 1, x: 0 }}
              initial={{ opacity: 0, x: 20 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="border-0 p-6 shadow-lg">
                <h3 className="mb-4 font-bold text-gray-900">Key Details</h3>
                <div className="space-y-4">
                  <div>
                    <div className="mb-1 text-gray-500 text-sm">Department</div>
                    <div className="text-gray-900">{department}</div>
                  </div>
                  <Separator />
                  <div>
                    <div className="mb-1 text-gray-500 text-sm">Category</div>
                    <div className="text-gray-900">{category}</div>
                  </div>
                  <Separator />
                  <div>
                    <div className="mb-1 text-gray-500 text-sm">Openings</div>
                    <div className="text-gray-900">
                      {openings} {openings === 1 ? "position" : "positions"}{" "}
                      available
                    </div>
                  </div>
                  <Separator />
                  <div>
                    <div className="mb-1 text-gray-500 text-sm">
                      Application Deadline
                    </div>
                    <div className="text-gray-900">{deadline}</div>
                  </div>
                </div>
              </Card>
            </motion.div>

            {/* Apply Card */}
            <motion.div
              animate={{ opacity: 1, x: 0 }}
              initial={{ opacity: 0, x: 20 }}
              transition={{ delay: 0.4 }}
            >
              <Card className="border-0 bg-linear-to-br from-[#001731] to-[#3DA9E0] p-6 shadow-lg">
                <h3 className="mb-4 font-bold text-white">Ready to Apply?</h3>
                <p className="mb-6 text-sm text-white/90">
                  Submit your application and join our team in creating amazing
                  experiences for students.
                </p>
                <Button className="mb-3 w-full bg-white text-[#001731] hover:bg-white/90">
                  <Send className="mr-2 h-4 w-4" />
                  Submit Application
                </Button>
                <Button
                  className="w-full border-white text-white hover:bg-white/10"
                  variant="outline"
                >
                  <Mail className="mr-2 h-4 w-4" />
                  Ask a Question
                </Button>
              </Card>
            </motion.div>

            {/* Contact Info */}
            <motion.div
              animate={{ opacity: 1, x: 0 }}
              initial={{ opacity: 0, x: 20 }}
              transition={{ delay: 0.5 }}
            >
              <Card className="border-0 bg-blue-50 p-6 shadow-lg">
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                  <div>
                    <h4 className="mb-2 font-semibold text-gray-900">
                      Questions?
                    </h4>
                    <p className="text-gray-600 text-sm">
                      Contact our recruitment team at{" "}
                      <a
                        className="text-[#3DA9E0] hover:underline"
                        href="mailto:recruitment@biso.no"
                      >
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
  );
}
