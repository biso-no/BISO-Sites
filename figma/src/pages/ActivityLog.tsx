import { useState } from "react";
import { motion } from "motion/react";
import { Link } from "react-router";
import { 
  Search, Filter, ChevronLeft, Calendar, 
  FileText, Briefcase, CalendarDays, ShoppingCart, Type,
  CheckCircle2, Edit3, Trash2, Globe
} from "lucide-react";
import { MOCK_USER_IMAGE } from "../data";

const ACTIVITY_LOG = [
  { id: 1, user: 'Alex Editor', role: 'Superadmin', action: 'published', target: 'Student Election Results 2026', type: 'news', time: '12 mins ago', icon: Globe, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  { id: 2, user: 'Sarah Jenkins', role: 'Editor', action: 'edited', target: 'Campus Life', type: 'page', time: '1 hour ago', icon: Edit3, color: 'text-[#3DA9E0]', bg: 'bg-[#3DA9E0]/10' },
  { id: 3, user: 'Event Team', role: 'Contributor', action: 'created draft', target: 'Fadderullan Main Party', type: 'event', time: '3 hours ago', icon: CalendarDays, color: 'text-amber-400', bg: 'bg-amber-400/10' },
  { id: 4, user: 'Shop Manager', role: 'Admin', action: 'updated stock', target: 'BISO Premium Hoodie', type: 'shop', time: 'Yesterday', icon: ShoppingCart, color: 'text-[#3DA9E0]', bg: 'bg-[#3DA9E0]/10' },
  { id: 5, user: 'Admin', role: 'Superadmin', action: 'deleted', target: 'Outdated Career Fair', type: 'event', time: 'Yesterday', icon: Trash2, color: 'text-red-400', bg: 'bg-red-400/10' },
  { id: 6, user: 'Alex Editor', role: 'Superadmin', action: 'published', target: 'Senior Frontend Developer', type: 'job', time: '2 days ago', icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  { id: 7, user: 'Sarah Jenkins', role: 'Editor', action: 'edited', target: 'BISO Alumni Pin', type: 'shop', time: '2 days ago', icon: Edit3, color: 'text-[#3DA9E0]', bg: 'bg-[#3DA9E0]/10' },
  { id: 8, user: 'Admin', role: 'Superadmin', action: 'created', target: 'Homepage Hero', type: 'page', time: '3 days ago', icon: FileText, color: 'text-[#3DA9E0]', bg: 'bg-[#3DA9E0]/10' },
];

const TYPE_ICONS = {
  page: FileText,
  job: Briefcase,
  event: CalendarDays,
  shop: ShoppingCart,
  news: Type
};

export function ActivityLog() {
  const [search, setSearch] = useState('');

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="max-w-5xl mx-auto space-y-8 pb-12"
    >
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pt-4 border-b border-white/10 pb-6">
        <div className="flex items-center gap-4">
          <Link 
            to="/"
            className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
          >
            <ChevronLeft size={20} />
          </Link>
          <div>
            <h1 className="text-3xl md:text-4xl font-light tracking-tight text-white">
              Activity Log
            </h1>
            <p className="text-white/50 mt-1 text-sm">System-wide audit trail of all changes.</p>
          </div>
        </div>
      </header>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={18} />
          <input 
            type="text" 
            placeholder="Search events, users, or targets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-2.5 text-white placeholder:text-white/40 outline-none focus:border-[#3DA9E0] transition-colors backdrop-blur-sm text-sm"
          />
        </div>
        <div className="flex gap-3 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 hide-scrollbar">
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-white/80 text-sm hover:bg-white/5 transition-all">
            <Calendar size={14} /> Last 7 Days
          </button>
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/80 text-sm hover:bg-white/10 transition-all">
            <Filter size={14} /> Filters
          </button>
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-white/[0.02] border border-white/[0.05] rounded-3xl p-6 md:p-8 backdrop-blur-sm">
        <div className="relative before:absolute before:inset-0 before:ml-6 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-[2px] before:bg-gradient-to-b before:from-[#3DA9E0]/50 before:via-white/10 before:to-transparent">
          {ACTIVITY_LOG.map((activity, i) => {
            const TypeIcon = TYPE_ICONS[activity.type as keyof typeof TYPE_ICONS];
            
            return (
              <motion.div 
                key={activity.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active mb-8 last:mb-0"
              >
                {/* Timeline Node */}
                <div className="flex items-center justify-center w-12 h-12 rounded-full border-4 border-[#000a16] bg-[#001731] shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 relative z-10 shadow-[0_0_15px_rgba(0,0,0,0.5)]">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${activity.bg}`}>
                    <activity.icon size={16} className={activity.color} />
                  </div>
                </div>
                
                {/* Content Card */}
                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-3rem)] p-5 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10 transition-all cursor-pointer group-hover:shadow-lg relative">
                  {/* Pointer arrow */}
                  <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white/[0.02] border-t border-r border-white/5 md:group-odd:-right-1.5 md:group-odd:rotate-45 md:group-even:-left-1.5 md:group-even:-rotate-[135deg] rotate-45 -left-1.5 hidden md:block group-hover:bg-white/[0.04] group-hover:border-white/10 transition-all" />

                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <img src={activity.id % 2 === 0 ? MOCK_USER_IMAGE : 'https://images.unsplash.com/photo-1770922809545-edc679cdf6d6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwb3J0cmFpdCUyMHByb2Zlc3Npb25hbCUyMHN0dWRlbnR8ZW58MXx8fHwxNzc1MjkyNTI4fDA&ixlib=rb-4.1.0&q=80&w=1080'} alt={activity.user} className="w-8 h-8 rounded-full object-cover border border-white/10" />
                      <div>
                        <p className="text-sm font-medium text-white">{activity.user}</p>
                        <p className="text-[10px] uppercase tracking-wider text-white/40">{activity.role}</p>
                      </div>
                    </div>
                    <span className="text-xs font-mono text-white/30">{activity.time}</span>
                  </div>

                  <p className="text-white/80 text-sm">
                    <span className="text-white/50">{activity.action}</span>{' '}
                    <span className="font-medium text-white">{activity.target}</span>
                  </p>

                  <div className="mt-4 pt-3 border-t border-white/5 flex items-center gap-2">
                    <span className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/5 text-white/50 text-[10px] uppercase tracking-widest font-semibold">
                      <TypeIcon size={10} /> {activity.type}
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
