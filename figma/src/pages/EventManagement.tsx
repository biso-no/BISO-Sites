import {
  Calendar as CalendarIcon,
  MapPin,
  MoreHorizontal,
  Plus,
  Search,
  Users,
} from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { Link } from "react-router";

const MOCK_EVENTS = [
  {
    id: "1",
    title: "Fadderullan Main Party 2026",
    date: "Aug 15, 2026 • 21:00",
    location: "Oslo Spektrum",
    attendees: 4500,
    capacity: 5000,
    status: "upcoming",
    revenue: "NOK 1,250,000",
    image:
      "https://images.unsplash.com/photo-1772251784323-5e317816a8de?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxldmVudCUyMGNvbmNlcnQlMjBjcm93ZCUyMGRhcmt8ZW58MXx8fHwxNzc1MjkyNTI4fDA&ixlib=rb-4.1.0&q=80&w=1080",
  },
  {
    id: "2",
    title: "BISO Networking Mixer",
    date: "Sep 02, 2026 • 18:00",
    location: "BI Campus Kroa",
    attendees: 320,
    capacity: 400,
    status: "upcoming",
    revenue: "Free",
    image:
      "https://images.unsplash.com/photo-1550305080-4e029753abcf?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxldmVudCUyMG5ldHdvcmtpbmclMjBzdHVkZW50c3xlbnwxfHx8fDE3NzUyOTMwODB8MA&ixlib=rb-4.1.0&q=80&w=1080",
  },
];

export function EventManagement() {
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
            Events
          </h1>
          <p className="mt-2 text-lg text-white/50">
            Curate unforgettable student experiences.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Link
            className="flex items-center gap-2 rounded-full bg-[#3DA9E0] px-6 py-3 font-semibold text-[#001731] shadow-[0_0_20px_rgba(61,169,224,0.3)] transition-all hover:shadow-[0_0_30px_rgba(61,169,224,0.5)]"
            to="/events/new"
          >
            <Plus size={18} />
            <span>New Event</span>
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
            placeholder="Search events..."
            type="text"
            value={search}
          />
        </div>
        <div className="hide-scrollbar flex w-full gap-3 overflow-x-auto pb-2 md:w-auto md:pb-0">
          {["Upcoming", "Past", "Drafts"].map((status) => (
            <button
              className="whitespace-nowrap rounded-full border border-white/10 px-5 py-2 text-sm text-white/60 transition-all hover:bg-white/5 hover:text-white"
              key={status}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {MOCK_EVENTS.map((event, i) => (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="group flex flex-col overflow-hidden rounded-3xl border border-white/[0.05] bg-white/[0.02] transition-all duration-300 hover:bg-white/[0.04]"
            initial={{ opacity: 0, y: 20 }}
            key={event.id}
            transition={{ delay: i * 0.1 }}
          >
            <div className="relative h-48 overflow-hidden md:h-64">
              <img
                alt={event.title}
                className="h-full w-full object-cover opacity-80 transition-transform duration-700 group-hover:scale-105 group-hover:opacity-100"
                src={event.image}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#000a16] via-transparent to-transparent opacity-90" />

              <div className="absolute top-4 left-4">
                <span className="rounded-full border border-[#3DA9E0]/40 bg-[#3DA9E0]/20 px-3 py-1 font-semibold text-[#3DA9E0] text-[11px] uppercase tracking-wider backdrop-blur-md">
                  {event.status}
                </span>
              </div>
              <div className="absolute top-4 right-4 cursor-pointer rounded-lg border border-white/10 bg-[#000a16]/80 p-2 opacity-0 backdrop-blur-md transition-opacity hover:bg-white/10 group-hover:opacity-100">
                <MoreHorizontal className="text-white" size={16} />
              </div>
            </div>

            <div className="flex flex-1 flex-col p-6">
              <Link
                className="mb-4 block font-medium text-2xl text-white transition-colors group-hover:text-[#3DA9E0]"
                to={`/events/${event.id}`}
              >
                {event.title}
              </Link>

              <div className="mb-6 grid grid-cols-2 gap-4 text-sm text-white/60">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="text-[#3DA9E0]" size={16} />
                  <span>{event.date}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="text-[#3DA9E0]" size={16} />
                  <span>{event.location}</span>
                </div>
              </div>

              <div className="mt-auto flex items-end justify-between border-white/5 border-t pt-4">
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <Users className="text-white/40" size={14} />
                    <span className="font-medium text-sm text-white">
                      {event.attendees}{" "}
                      <span className="text-white/40">/ {event.capacity}</span>
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-[#3DA9E0] shadow-[0_0_10px_#3DA9E0]"
                      style={{
                        width: `${(event.attendees / event.capacity) * 100}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="text-right">
                  <p className="mb-1 text-[10px] text-white/40 uppercase tracking-wider">
                    Revenue
                  </p>
                  <p className="font-medium text-emerald-400 text-lg">
                    {event.revenue}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
