import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus, Search, Filter, MoreHorizontal, Briefcase, Users, Eye, CheckCircle2 } from "lucide-react";
import { Link } from "react-router";

const MOCK_JOBS = [
  {
    id: '1',
    title: 'Senior Frontend Developer',
    company: 'TechCorp Oslo',
    type: 'Full-time',
    applicants: 45,
    views: 1200,
    status: 'active',
    posted: '2 days ago',
    logo: 'https://images.unsplash.com/photo-1668714341253-81139e265a19?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxvZmZpY2UlMjB3b3Jrc3BhY2UlMjB0ZWNoJTIwZGFya3xlbnwxfHx8fDE3NzUyOTMwODB8MA&ixlib=rb-4.1.0&q=80&w=1080'
  },
  {
    id: '2',
    title: 'Marketing Intern',
    company: 'BISO',
    type: 'Part-time',
    applicants: 128,
    views: 3400,
    status: 'active',
    posted: '1 week ago',
    logo: 'https://images.unsplash.com/photo-1770922809545-edc679cdf6d6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwb3J0cmFpdCUyMHByb2Zlc3Npb25hbCUyMHN0dWRlbnR8ZW58MXx8fHwxNzc1MjkyNTI4fDA&ixlib=rb-4.1.0&q=80&w=1080'
  },
  {
    id: '3',
    title: 'Financial Analyst Graduate',
    company: 'Nordic Bank',
    type: 'Graduate',
    applicants: 312,
    views: 8900,
    status: 'closed',
    posted: '1 month ago',
    logo: 'https://images.unsplash.com/photo-1770745560239-f65a0dba5f04?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkYXJrJTIwYWJzdHJhY3QlMjBtb2Rlcm4lMjBiYWNrZ3JvdW5kfGVufDF8fHx8MTc3NTI5MjUyOHww&ixlib=rb-4.1.0&q=80&w=1080'
  }
];

export function JobManagement() {
  const [search, setSearch] = useState('');

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-8 pb-12"
    >
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pt-4">
        <div>
          <h1 className="text-4xl md:text-5xl font-light tracking-tight text-white">
            Job Board
          </h1>
          <p className="text-white/50 mt-2 text-lg">Manage career opportunities for students.</p>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/jobs/new" className="flex items-center gap-2 px-6 py-3 rounded-full bg-[#3DA9E0] text-[#001731] font-semibold shadow-[0_0_20px_rgba(61,169,224,0.3)] hover:shadow-[0_0_30px_rgba(61,169,224,0.5)] transition-all">
            <Plus size={18} />
            <span>Post Job</span>
          </Link>
        </div>
      </header>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={18} />
          <input 
            type="text" 
            placeholder="Search jobs or companies..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-3 text-white placeholder:text-white/40 outline-none focus:border-[#3DA9E0] transition-colors backdrop-blur-sm"
          />
        </div>
        <div className="flex gap-3 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 hide-scrollbar">
          {['All Roles', 'Full-time', 'Part-time', 'Internship'].map((status) => (
            <button key={status} className="px-5 py-2 rounded-full border border-white/10 text-white/60 text-sm whitespace-nowrap hover:bg-white/5 hover:text-white transition-all">
              {status}
            </button>
          ))}
          <button className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-white/80 text-sm hover:bg-white/10 transition-all">
            <Filter size={14} /> Filters
          </button>
        </div>
      </div>

      {/* Jobs List */}
      <div className="space-y-4">
        {MOCK_JOBS.map((job, i) => (
          <motion.div
            key={job.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="group flex flex-col md:flex-row items-start md:items-center justify-between p-6 rounded-3xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] transition-all duration-300"
          >
            <div className="flex items-center gap-6 mb-4 md:mb-0">
              <div className="w-16 h-16 rounded-2xl overflow-hidden shrink-0 border border-white/10">
                <img src={job.logo} alt={job.company} className="w-full h-full object-cover" />
              </div>
              <div>
                <Link to={`/jobs/${job.id}`} className="text-xl font-medium text-white group-hover:text-[#3DA9E0] transition-colors block">
                  {job.title}
                </Link>
                <div className="flex items-center gap-3 mt-2 text-sm text-white/50">
                  <span className="flex items-center gap-1.5"><Briefcase size={14} /> {job.company}</span>
                  <span className="w-1 h-1 rounded-full bg-white/20" />
                  <span>{job.type}</span>
                  <span className="w-1 h-1 rounded-full bg-white/20" />
                  <span>{job.posted}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-8 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 border-white/5 pt-4 md:pt-0">
              <div className="flex items-center gap-6">
                <div className="flex flex-col items-center">
                  <span className="flex items-center gap-1.5 text-white font-medium">
                    <Users size={16} className="text-[#3DA9E0]" /> {job.applicants}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider text-white/40 mt-1">Applicants</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="flex items-center gap-1.5 text-white font-medium">
                    <Eye size={16} className="text-white/40" /> {job.views}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider text-white/40 mt-1">Views</span>
                </div>
              </div>

              <div className="flex items-center gap-4 pl-4 md:pl-8 border-l border-white/10">
                {job.status === 'active' ? (
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#3DA9E0]/10 border border-[#3DA9E0]/30 text-[#3DA9E0] text-[11px] font-semibold tracking-wider uppercase">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#3DA9E0]" /> Active
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white/50 text-[11px] font-semibold tracking-wider uppercase">
                    <CheckCircle2 size={12} /> Closed
                  </span>
                )}
                <button className="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-all">
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
