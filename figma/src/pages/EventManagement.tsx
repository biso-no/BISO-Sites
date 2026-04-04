import { useState } from "react";
import { Link } from "react-router";
import { motion } from "motion/react";
import { Plus, Search, Filter, Calendar as CalendarIcon, MapPin, Users, MoreHorizontal } from "lucide-react";

const MOCK_EVENTS = [
  {
    id: '1',
    title: 'Fadderullan Main Party 2026',
    date: 'Aug 15, 2026 • 21:00',
    location: 'Oslo Spektrum',
    attendees: 4500,
    capacity: 5000,
    status: 'upcoming',
    revenue: 'NOK 1,250,000',
    image: 'https://images.unsplash.com/photo-1772251784323-5e317816a8de?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxldmVudCUyMGNvbmNlcnQlMjBjcm93ZCUyMGRhcmt8ZW58MXx8fHwxNzc1MjkyNTI4fDA&ixlib=rb-4.1.0&q=80&w=1080'
  },
  {
    id: '2',
    title: 'BISO Networking Mixer',
    date: 'Sep 02, 2026 • 18:00',
    location: 'BI Campus Kroa',
    attendees: 320,
    capacity: 400,
    status: 'upcoming',
    revenue: 'Free',
    image: 'https://images.unsplash.com/photo-1550305080-4e029753abcf?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxldmVudCUyMG5ldHdvcmtpbmclMjBzdHVkZW50c3xlbnwxfHx8fDE3NzUyOTMwODB8MA&ixlib=rb-4.1.0&q=80&w=1080'
  }
];

export function EventManagement() {
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
            Events
          </h1>
          <p className="text-white/50 mt-2 text-lg">Curate unforgettable student experiences.</p>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/events/new" className="flex items-center gap-2 px-6 py-3 rounded-full bg-[#3DA9E0] text-[#001731] font-semibold shadow-[0_0_20px_rgba(61,169,224,0.3)] hover:shadow-[0_0_30px_rgba(61,169,224,0.5)] transition-all">
            <Plus size={18} />
            <span>New Event</span>
          </Link>
        </div>
      </header>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={18} />
          <input 
            type="text" 
            placeholder="Search events..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-3 text-white placeholder:text-white/40 outline-none focus:border-[#3DA9E0] transition-colors backdrop-blur-sm"
          />
        </div>
        <div className="flex gap-3 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 hide-scrollbar">
          {['Upcoming', 'Past', 'Drafts'].map((status) => (
            <button key={status} className="px-5 py-2 rounded-full border border-white/10 text-white/60 text-sm whitespace-nowrap hover:bg-white/5 hover:text-white transition-all">
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {MOCK_EVENTS.map((event, i) => (
          <motion.div 
            key={event.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="group rounded-3xl bg-white/[0.02] border border-white/[0.05] overflow-hidden hover:bg-white/[0.04] transition-all duration-300 flex flex-col"
          >
            <div className="relative h-48 md:h-64 overflow-hidden">
              <img 
                src={event.image} 
                alt={event.title}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-80 group-hover:opacity-100"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#000a16] via-transparent to-transparent opacity-90" />
              
              <div className="absolute top-4 left-4">
                <span className="px-3 py-1 rounded-full bg-[#3DA9E0]/20 border border-[#3DA9E0]/40 text-[#3DA9E0] text-[11px] font-semibold tracking-wider uppercase backdrop-blur-md">
                  {event.status}
                </span>
              </div>
              <div className="absolute top-4 right-4 bg-[#000a16]/80 backdrop-blur-md rounded-lg p-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer border border-white/10 hover:bg-white/10">
                <MoreHorizontal size={16} className="text-white" />
              </div>
            </div>

            <div className="p-6 flex-1 flex flex-col">
              <Link to={`/events/${event.id}`} className="text-2xl font-medium text-white mb-4 group-hover:text-[#3DA9E0] transition-colors block">
                {event.title}
              </Link>
              
              <div className="grid grid-cols-2 gap-4 mb-6 text-sm text-white/60">
                <div className="flex items-center gap-2">
                  <CalendarIcon size={16} className="text-[#3DA9E0]" />
                  <span>{event.date}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin size={16} className="text-[#3DA9E0]" />
                  <span>{event.location}</span>
                </div>
              </div>

              <div className="mt-auto pt-4 border-t border-white/5 flex items-end justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Users size={14} className="text-white/40" />
                    <span className="text-sm font-medium text-white">{event.attendees} <span className="text-white/40">/ {event.capacity}</span></span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-1.5 mt-2 overflow-hidden">
                    <div 
                      className="bg-[#3DA9E0] h-full rounded-full shadow-[0_0_10px_#3DA9E0]" 
                      style={{ width: `${(event.attendees / event.capacity) * 100}%` }}
                    />
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1">Revenue</p>
                  <p className="text-lg font-medium text-emerald-400">{event.revenue}</p>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
