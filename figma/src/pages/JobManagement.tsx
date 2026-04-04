import {
  Briefcase,
  CheckCircle2,
  Eye,
  Filter,
  MoreHorizontal,
  Plus,
  Search,
  Users,
} from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { Link } from "react-router";

const MOCK_JOBS = [
  {
    id: "1",
    title: "Senior Frontend Developer",
    company: "TechCorp Oslo",
    type: "Full-time",
    applicants: 45,
    views: 1200,
    status: "active",
    posted: "2 days ago",
    logo: "https://images.unsplash.com/photo-1668714341253-81139e265a19?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxvZmZpY2UlMjB3b3Jrc3BhY2UlMjB0ZWNoJTIwZGFya3xlbnwxfHx8fDE3NzUyOTMwODB8MA&ixlib=rb-4.1.0&q=80&w=1080",
  },
  {
    id: "2",
    title: "Marketing Intern",
    company: "BISO",
    type: "Part-time",
    applicants: 128,
    views: 3400,
    status: "active",
    posted: "1 week ago",
    logo: "https://images.unsplash.com/photo-1770922809545-edc679cdf6d6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwb3J0cmFpdCUyMHByb2Zlc3Npb25hbCUyMHN0dWRlbnR8ZW58MXx8fHwxNzc1MjkyNTI4fDA&ixlib=rb-4.1.0&q=80&w=1080",
  },
  {
    id: "3",
    title: "Financial Analyst Graduate",
    company: "Nordic Bank",
    type: "Graduate",
    applicants: 312,
    views: 8900,
    status: "closed",
    posted: "1 month ago",
    logo: "https://images.unsplash.com/photo-1770745560239-f65a0dba5f04?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkYXJrJTIwYWJzdHJhY3QlMjBtb2Rlcm4lMjBiYWNrZ3JvdW5kfGVufDF8fHx8MTc3NTI5MjUyOHww&ixlib=rb-4.1.0&q=80&w=1080",
  },
];

export function JobManagement() {
  const [search, setSearch] = useState("");

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 pb-12"
      initial={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.5 }}
    >
      <header className="flex flex-col justify-between gap-6 pt-4 md:flex-row md:items-end">
        <div>
          <h1 className="font-light text-4xl text-white tracking-tight md:text-5xl">
            Job Board
          </h1>
          <p className="mt-2 text-lg text-white/50">
            Manage career opportunities for students.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Link
            className="flex items-center gap-2 rounded-full bg-[#3DA9E0] px-6 py-3 font-semibold text-[#001731] shadow-[0_0_20px_rgba(61,169,224,0.3)] transition-all hover:shadow-[0_0_30px_rgba(61,169,224,0.5)]"
            to="/jobs/new"
          >
            <Plus size={18} />
            <span>Post Job</span>
          </Link>
        </div>
      </header>

      {/* Toolbar */}
      <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
        <div className="relative w-full md:w-96">
          <Search
            className="absolute top-1/2 left-4 -translate-y-1/2 text-white/40"
            size={18}
          />
          <input
            className="w-full rounded-2xl border border-white/10 bg-white/5 py-3 pr-4 pl-12 text-white outline-none backdrop-blur-sm transition-colors placeholder:text-white/40 focus:border-[#3DA9E0]"
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search jobs or companies..."
            type="text"
            value={search}
          />
        </div>
        <div className="hide-scrollbar flex w-full gap-3 overflow-x-auto pb-2 md:w-auto md:pb-0">
          {["All Roles", "Full-time", "Part-time", "Internship"].map(
            (status) => (
              <button
                className="whitespace-nowrap rounded-full border border-white/10 px-5 py-2 text-sm text-white/60 transition-all hover:bg-white/5 hover:text-white"
                key={status}
              >
                {status}
              </button>
            )
          )}
          <button className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition-all hover:bg-white/10">
            <Filter size={14} /> Filters
          </button>
        </div>
      </div>

      {/* Jobs List */}
      <div className="space-y-4">
        {MOCK_JOBS.map((job, i) => (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="group flex flex-col items-start justify-between rounded-3xl border border-white/[0.05] bg-white/[0.02] p-6 transition-all duration-300 hover:bg-white/[0.04] md:flex-row md:items-center"
            initial={{ opacity: 0, y: 10 }}
            key={job.id}
            transition={{ delay: i * 0.1 }}
          >
            <div className="mb-4 flex items-center gap-6 md:mb-0">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-white/10">
                <img
                  alt={job.company}
                  className="h-full w-full object-cover"
                  src={job.logo}
                />
              </div>
              <div>
                <Link
                  className="block font-medium text-white text-xl transition-colors group-hover:text-[#3DA9E0]"
                  to={`/jobs/${job.id}`}
                >
                  {job.title}
                </Link>
                <div className="mt-2 flex items-center gap-3 text-sm text-white/50">
                  <span className="flex items-center gap-1.5">
                    <Briefcase size={14} /> {job.company}
                  </span>
                  <span className="h-1 w-1 rounded-full bg-white/20" />
                  <span>{job.type}</span>
                  <span className="h-1 w-1 rounded-full bg-white/20" />
                  <span>{job.posted}</span>
                </div>
              </div>
            </div>

            <div className="flex w-full items-center justify-between gap-8 border-white/5 border-t pt-4 md:w-auto md:justify-end md:border-t-0 md:pt-0">
              <div className="flex items-center gap-6">
                <div className="flex flex-col items-center">
                  <span className="flex items-center gap-1.5 font-medium text-white">
                    <Users className="text-[#3DA9E0]" size={16} />{" "}
                    {job.applicants}
                  </span>
                  <span className="mt-1 text-[10px] text-white/40 uppercase tracking-wider">
                    Applicants
                  </span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="flex items-center gap-1.5 font-medium text-white">
                    <Eye className="text-white/40" size={16} /> {job.views}
                  </span>
                  <span className="mt-1 text-[10px] text-white/40 uppercase tracking-wider">
                    Views
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-4 border-white/10 border-l pl-4 md:pl-8">
                {job.status === "active" ? (
                  <span className="flex items-center gap-1.5 rounded-full border border-[#3DA9E0]/30 bg-[#3DA9E0]/10 px-3 py-1 font-semibold text-[#3DA9E0] text-[11px] uppercase tracking-wider">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#3DA9E0]" />{" "}
                    Active
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 font-semibold text-[11px] text-white/50 uppercase tracking-wider">
                    <CheckCircle2 size={12} /> Closed
                  </span>
                )}
                <button className="rounded-lg p-2 text-white/40 transition-all hover:bg-white/10 hover:text-white">
                  <MoreHorizontal size={18} />
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
