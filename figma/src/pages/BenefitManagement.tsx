import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Link } from "react-router";
import { 
  Gift, Search, Filter, Plus, Globe, MapPin, 
  Percent, Ticket, Coffee, Sparkles, ExternalLink, ShieldCheck, Zap
} from "lucide-react";

const BENEFITS = [
  {
    id: '1',
    title: '20% Off All Beverages',
    provider: 'Espresso House',
    type: 'Discount',
    scope: 'National',
    status: 'Active',
    uses: '12.4k',
    isPartnerSynced: true,
    image: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb2ZmZWUlMjBzaG9wfGVufDF8fHx8MTc3NTI5NjAwMHww&ixlib=rb-4.1.0&q=80&w=1080'
  },
  {
    id: '2',
    title: 'Free Tuesday Lunch',
    provider: 'BISO Campus',
    type: 'Service',
    scope: 'Oslo',
    status: 'Active',
    uses: '850',
    isPartnerSynced: false,
    image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdW5jaCUyMGZvb2R8ZW58MXx8fHwxNzc1Mjk2MTEyfDA&ixlib=rb-4.1.0&q=80&w=1080'
  },
  {
    id: '3',
    title: 'VIP Fast-Track Entry',
    provider: 'Fadderullan',
    type: 'Access',
    scope: 'National',
    status: 'Active',
    uses: '3.2k',
    isPartnerSynced: false,
    image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjbHViJTIwcGFydHl8ZW58MXx8fHwxNzc1Mjk2MTQ3fDA&ixlib=rb-4.1.0&q=80&w=1080'
  },
  {
    id: '4',
    title: 'Free Exam Prep Course',
    provider: 'BISO Academic',
    type: 'Service',
    scope: 'Bergen',
    status: 'Scheduled',
    uses: '-',
    isPartnerSynced: false,
    image: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzdHVkeSUyMGV4YW18ZW58MXx8fHwxNzc1Mjk2MTc5fDA&ixlib=rb-4.1.0&q=80&w=1080'
  },
  {
    id: '5',
    title: '30% Off Gym Memberships',
    provider: 'SATS',
    type: 'Discount',
    scope: 'National',
    status: 'Active',
    uses: '5.1k',
    isPartnerSynced: true,
    image: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxneW18ZW58MXx8fHwxNzc1Mjk2MjA1fDA&ixlib=rb-4.1.0&q=80&w=1080'
  }
];

const TYPE_ICONS = {
  'Discount': Percent,
  'Service': Coffee,
  'Access': Ticket,
  'Other': Gift
};

export function BenefitManagement() {
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-8 pb-12"
    >
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pt-4">
        <div>
          <h1 className="text-4xl md:text-5xl font-light tracking-tight text-white flex items-center gap-4">
            Member Benefits
          </h1>
          <p className="text-white/50 mt-2 text-lg">Manage exclusive perks, discounts, and services for BISO members.</p>
        </div>
        <Link 
          to="/benefits/new"
          className="flex items-center gap-2 px-6 py-3 rounded-full bg-[#3DA9E0] text-[#001731] font-semibold shadow-[0_0_20px_rgba(61,169,224,0.3)] hover:shadow-[0_0_30px_rgba(61,169,224,0.5)] transition-all"
        >
          <Plus size={18} />
          <span>Create Benefit</span>
        </Link>
      </header>

      {/* Partner Integration Banner */}
      <div className="relative overflow-hidden rounded-2xl p-6 md:p-8 bg-gradient-to-br from-[#001731] to-[#000a16] border border-[#3DA9E0]/30 shadow-[0_0_30px_rgba(61,169,224,0.1)] group">
        <div className="absolute right-0 top-0 w-64 h-64 bg-[#3DA9E0]/10 rounded-full blur-[80px] group-hover:bg-[#3DA9E0]/20 transition-all duration-700" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex gap-4 items-start">
            <div className="w-12 h-12 rounded-xl bg-[#3DA9E0]/10 flex items-center justify-center border border-[#3DA9E0]/30 shrink-0">
              <Zap size={24} className="text-[#3DA9E0]" />
            </div>
            <div>
              <h2 className="text-xl font-medium text-white flex items-center gap-2">
                Partner API Integration <span className="px-2 py-0.5 rounded text-[10px] uppercase tracking-wider bg-[#3DA9E0]/20 text-[#3DA9E0] border border-[#3DA9E0]/30">Beta</span>
              </h2>
              <p className="text-white/60 text-sm mt-1 max-w-2xl leading-relaxed">
                External partners can now automatically submit and manage their discounts via the BISO Partner API. Synced benefits require approval before going live to students.
              </p>
            </div>
          </div>
          <Link to="/benefits/partners" className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/20 bg-white/5 text-white font-medium hover:bg-white/10 transition-all shrink-0 text-sm">
            <ExternalLink size={16} /> Manage Partners
          </Link>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={18} />
          <input 
            type="text" 
            placeholder="Search benefits or providers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-3 text-white placeholder:text-white/40 outline-none focus:border-[#3DA9E0] transition-colors backdrop-blur-sm"
          />
        </div>
        <div className="flex gap-3 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 hide-scrollbar">
          {['All', 'National', 'Campus Specific', 'Active', 'Partner Synced'].map((filter) => (
            <button 
              key={filter}
              onClick={() => setActiveFilter(filter)} 
              className={`px-5 py-2 rounded-full border text-sm whitespace-nowrap transition-all ${
                activeFilter === filter 
                  ? 'border-[#3DA9E0]/30 bg-[#3DA9E0]/10 text-[#3DA9E0]' 
                  : 'border-white/10 text-white/60 hover:bg-white/5 hover:text-white'
              }`}
            >
              {filter}
            </button>
          ))}
          <button className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-white/80 text-sm hover:bg-white/10 transition-all shrink-0">
            <Filter size={14} /> Filters
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence>
          {BENEFITS.filter(b => b.title.toLowerCase().includes(search.toLowerCase()) || b.provider.toLowerCase().includes(search.toLowerCase())).map((benefit, i) => {
            const TypeIcon = TYPE_ICONS[benefit.type as keyof typeof TYPE_ICONS] || Gift;
            
            return (
              <motion.div
                layout
                key={benefit.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className="rounded-3xl bg-white/[0.02] border border-white/[0.05] overflow-hidden group flex flex-col backdrop-blur-sm relative"
              >
                {/* Image Cover */}
                <div className="h-40 relative overflow-hidden bg-[#001731]">
                  <img 
                    src={benefit.image} 
                    alt={benefit.title}
                    className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-700 group-hover:opacity-80"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#000a16] via-[#000a16]/40 to-transparent" />
                  
                  <div className="absolute top-4 left-4 flex gap-2">
                    <span className={`px-2.5 py-1 rounded-md text-[10px] uppercase tracking-wider font-semibold border backdrop-blur-md flex items-center gap-1.5 ${
                      benefit.scope === 'National' ? 'bg-[#3DA9E0]/20 text-[#3DA9E0] border-[#3DA9E0]/30' : 'bg-emerald-400/20 text-emerald-400 border-emerald-400/30'
                    }`}>
                      {benefit.scope === 'National' ? <Globe size={12} /> : <MapPin size={12} />}
                      {benefit.scope}
                    </span>
                  </div>
                  <div className="absolute top-4 right-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider font-bold border backdrop-blur-md ${
                      benefit.status === 'Active' ? 'bg-emerald-400/20 text-emerald-400 border-emerald-400/30' : 'bg-amber-400/20 text-amber-400 border-amber-400/30'
                    }`}>
                      {benefit.status}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-6 flex-1 flex flex-col relative z-10 -mt-6">
                  <div className="bg-[#000a16]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-5 mb-4 shadow-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-white/50 text-xs font-mono uppercase tracking-wider flex items-center gap-1">
                        <TypeIcon size={12} /> {benefit.type}
                      </span>
                      {benefit.isPartnerSynced && (
                        <span className="ml-auto text-[#3DA9E0] text-[10px] uppercase tracking-wider font-bold flex items-center gap-1">
                          <ShieldCheck size={12} /> API Synced
                        </span>
                      )}
                    </div>
                    <h3 className="text-xl font-medium text-white mb-1 line-clamp-1">{benefit.title}</h3>
                    <p className="text-[#3DA9E0] font-medium text-sm">{benefit.provider}</p>
                  </div>

                  <div className="mt-auto grid grid-cols-2 gap-3">
                    <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-white/5 border border-white/5">
                      <span className="text-white/40 text-[10px] uppercase tracking-widest mb-1">Total Claims</span>
                      <span className="text-white font-mono">{benefit.uses}</span>
                    </div>
                    <Link 
                      to={`/benefits/${benefit.id}`}
                      className="flex items-center justify-center gap-2 py-3 rounded-xl bg-white/10 border border-white/10 text-white font-medium hover:bg-white/20 transition-all text-sm"
                    >
                      Configure
                    </Link>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
