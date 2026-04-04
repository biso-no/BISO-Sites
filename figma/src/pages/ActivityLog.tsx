import {
  Briefcase,
  Calendar,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  Edit3,
  FileText,
  Filter,
  Globe,
  Search,
  ShoppingCart,
  Trash2,
  Type,
} from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { Link } from "react-router";
import { MOCK_USER_IMAGE } from "../data";

const ACTIVITY_LOG = [
  {
    id: 1,
    user: "Alex Editor",
    role: "Superadmin",
    action: "published",
    target: "Student Election Results 2026",
    type: "news",
    time: "12 mins ago",
    icon: Globe,
    color: "text-emerald-400",
    bg: "bg-emerald-400/10",
  },
  {
    id: 2,
    user: "Sarah Jenkins",
    role: "Editor",
    action: "edited",
    target: "Campus Life",
    type: "page",
    time: "1 hour ago",
    icon: Edit3,
    color: "text-[#3DA9E0]",
    bg: "bg-[#3DA9E0]/10",
  },
  {
    id: 3,
    user: "Event Team",
    role: "Contributor",
    action: "created draft",
    target: "Fadderullan Main Party",
    type: "event",
    time: "3 hours ago",
    icon: CalendarDays,
    color: "text-amber-400",
    bg: "bg-amber-400/10",
  },
  {
    id: 4,
    user: "Shop Manager",
    role: "Admin",
    action: "updated stock",
    target: "BISO Premium Hoodie",
    type: "shop",
    time: "Yesterday",
    icon: ShoppingCart,
    color: "text-[#3DA9E0]",
    bg: "bg-[#3DA9E0]/10",
  },
  {
    id: 5,
    user: "Admin",
    role: "Superadmin",
    action: "deleted",
    target: "Outdated Career Fair",
    type: "event",
    time: "Yesterday",
    icon: Trash2,
    color: "text-red-400",
    bg: "bg-red-400/10",
  },
  {
    id: 6,
    user: "Alex Editor",
    role: "Superadmin",
    action: "published",
    target: "Senior Frontend Developer",
    type: "job",
    time: "2 days ago",
    icon: CheckCircle2,
    color: "text-emerald-400",
    bg: "bg-emerald-400/10",
  },
  {
    id: 7,
    user: "Sarah Jenkins",
    role: "Editor",
    action: "edited",
    target: "BISO Alumni Pin",
    type: "shop",
    time: "2 days ago",
    icon: Edit3,
    color: "text-[#3DA9E0]",
    bg: "bg-[#3DA9E0]/10",
  },
  {
    id: 8,
    user: "Admin",
    role: "Superadmin",
    action: "created",
    target: "Homepage Hero",
    type: "page",
    time: "3 days ago",
    icon: FileText,
    color: "text-[#3DA9E0]",
    bg: "bg-[#3DA9E0]/10",
  },
];

const TYPE_ICONS = {
  page: FileText,
  job: Briefcase,
  event: CalendarDays,
  shop: ShoppingCart,
  news: Type,
};

export function ActivityLog() {
  const [search, setSearch] = useState("");

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-5xl space-y-8 pb-12"
      initial={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.5 }}
    >
      <header className="flex flex-col justify-between gap-6 border-white/10 border-b pt-4 pb-6 md:flex-row md:items-end">
        <div className="flex items-center gap-4">
          <Link
            className="rounded-lg p-2 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
            to="/"
          >
            <ChevronLeft size={20} />
          </Link>
          <div>
            <h1 className="font-light text-3xl text-white tracking-tight md:text-4xl">
              Activity Log
            </h1>
            <p className="mt-1 text-sm text-white/50">
              System-wide audit trail of all changes.
            </p>
          </div>
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
            className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pr-4 pl-12 text-sm text-white outline-none backdrop-blur-sm transition-colors placeholder:text-white/40 focus:border-[#3DA9E0]"
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search events, users, or targets..."
            type="text"
            value={search}
          />
        </div>
        <div className="hide-scrollbar flex w-full gap-3 overflow-x-auto pb-2 md:w-auto md:pb-0">
          <button className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-white/80 transition-all hover:bg-white/5">
            <Calendar size={14} /> Last 7 Days
          </button>
          <button className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition-all hover:bg-white/10">
            <Filter size={14} /> Filters
          </button>
        </div>
      </div>

      {/* Timeline */}
      <div className="rounded-3xl border border-white/5 bg-white/2 p-6 backdrop-blur-sm md:p-8">
        <div className="relative before:absolute before:inset-0 before:ml-6 before:h-full before:w-[2px] before:-translate-x-px before:bg-linear-to-b before:from-[#3DA9E0]/50 before:via-white/10 before:to-transparent md:before:mx-auto md:before:translate-x-0">
          {ACTIVITY_LOG.map((activity, i) => {
            const TypeIcon =
              TYPE_ICONS[activity.type as keyof typeof TYPE_ICONS];

            return (
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                className="group is-active relative mb-8 flex items-center justify-between last:mb-0 md:justify-normal md:odd:flex-row-reverse"
                initial={{ opacity: 0, y: 10 }}
                key={activity.id}
                transition={{ delay: i * 0.05 }}
              >
                {/* Timeline Node */}
                <div className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-4 border-[#000a16] bg-[#001731] shadow-[0_0_15px_rgba(0,0,0,0.5)] md:order-1 md:group-even:translate-x-1/2 md:group-odd:-translate-x-1/2">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full ${activity.bg}`}
                  >
                    <activity.icon className={activity.color} size={16} />
                  </div>
                </div>

                {/* Content Card */}
                <div className="relative w-[calc(100%-4rem)] cursor-pointer rounded-2xl border border-white/5 bg-white/2 p-5 transition-all hover:border-white/10 hover:bg-white/4 group-hover:shadow-lg md:w-[calc(50%-3rem)]">
                  {/* Pointer arrow */}
                  <div className="absolute top-1/2 -left-1.5 hidden h-3 w-3 -translate-y-1/2 rotate-45 border-white/5 border-t border-r bg-white/2 transition-all group-hover:border-white/10 group-hover:bg-white/4 md:block md:group-even:-left-1.5 md:group-even:-rotate-135 md:group-odd:-right-1.5 md:group-odd:rotate-45" />

                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <img
                        alt={activity.user}
                        className="h-8 w-8 rounded-full border border-white/10 object-cover"
                        src={
                          activity.id % 2 === 0
                            ? MOCK_USER_IMAGE
                            : "https://images.unsplash.com/photo-1770922809545-edc679cdf6d6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwb3J0cmFpdCUyMHByb2Zlc3Npb25hbCUyMHN0dWRlbnR8ZW58MXx8fHwxNzc1MjkyNTI4fDA&ixlib=rb-4.1.0&q=80&w=1080"
                        }
                      />
                      <div>
                        <p className="font-medium text-sm text-white">
                          {activity.user}
                        </p>
                        <p className="text-[10px] text-white/40 uppercase tracking-wider">
                          {activity.role}
                        </p>
                      </div>
                    </div>
                    <span className="font-mono text-white/30 text-xs">
                      {activity.time}
                    </span>
                  </div>

                  <p className="text-sm text-white/80">
                    <span className="text-white/50">{activity.action}</span>{" "}
                    <span className="font-medium text-white">
                      {activity.target}
                    </span>
                  </p>

                  <div className="mt-4 flex items-center gap-2 border-white/5 border-t pt-3">
                    <span className="flex items-center gap-1.5 rounded bg-white/5 px-2 py-1 font-semibold text-[10px] text-white/50 uppercase tracking-widest">
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
