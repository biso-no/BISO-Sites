import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Link } from "react-router";
import { 
  Building2, Search, Filter, RefreshCw, 
  MapPin, Users, Globe, Plus, Edit3, Shield, Info
} from "lucide-react";

// Mock Data for externally synced departments
const DEPARTMENTS = [
  {
    id: 'dept_1',
    name: 'National Board',
    type: 'Board',
    campus: 'National',
    memberCount: 8,
    pageId: 'pg_124',
    slug: '/departments/national-board',
    lastSynced: '2 mins ago',
    image: 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtZWV0aW5nJTIwYm9hcmRyb29tJTIwZGFya3xlbnwxfHx8fDE3NzUyOTUwNTl8MA&ixlib=rb-4.1.0&q=80&w=1080'
  },
  {
    id: 'dept_2',
    name: 'BISO Event Oslo',
    type: 'Committee',
    campus: 'Oslo',
    memberCount: 45,
    pageId: 'pg_123',
    slug: '/departments/biso-event-oslo',
    lastSynced: '2 mins ago',
    image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjcm93ZCUyMGV2ZW50JTIwbmlnaHR8ZW58MXx8fHwxNzc1Mjk1MDU5fDA&ixlib=rb-4.1.0&q=80&w=1080'
  },
  {
    id: 'dept_3',
    name: 'BISO HR',
    type: 'Staff',
    campus: 'National',
    memberCount: 12,
    pageId: null, // No page created yet
    slug: '/departments/biso-hr',
    lastSynced: '2 mins ago',
    image: 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxvZmZpY2UlMjB3b3Jrc3BhY2UlMjBwZW9wbGV8ZW58MXx8fHwxNzc1Mjk1MDU5fDA&ixlib=rb-4.1.0&q=80&w=1080'
  },
  {
    id: 'dept_4',
    name: 'Fadderullan Bergen',
    type: 'Project',
    campus: 'Bergen',
    memberCount: 150,
    pageId: 'pg_125',
    slug: '/departments/fadderullan-bergen',
    lastSynced: '2 mins ago',
    image: 'https://images.unsplash.com/photo-1528605248644-14dd04022da1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzdHVkZW50cyUyMHBhcnR5fGVufDF8fHx8MTc3NTI5NTA1OXww&ixlib=rb-4.1.0&q=80&w=1080'
  },
  {
    id: 'dept_5',
    name: 'BISO Finance',
    type: 'Staff',
    campus: 'National',
    memberCount: 6,
    pageId: null,
    slug: '/departments/biso-finance',
    lastSynced: '2 mins ago',
    image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmaW5hbmNlJTIwc3RhdHMlMjBkYXJrfGVufDF8fHx8MTc3NTI5NTIwNnww&ixlib=rb-4.1.0&q=80&w=1080'
  }
];

export function DepartmentManagement() {
  const [search, setSearch] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = () => {
    setIsSyncing(true);
    setTimeout(() => setIsSyncing(false), 2000);
  };

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
            Departments
            <span className="px-3 py-1 bg-white/10 text-white/50 text-xs font-mono uppercase tracking-widest rounded-full border border-white/10">Read-Only Source</span>
          </h1>
          <p className="text-white/50 mt-2 text-lg">Synced from external directory. Manage their dedicated CMS pages below.</p>
        </div>
        <button 
          onClick={handleSync}
          disabled={isSyncing}
          className="flex items-center gap-2 px-6 py-3 rounded-xl border border-white/20 bg-white/5 text-white font-medium hover:bg-white/10 transition-all shadow-[0_0_20px_rgba(255,255,255,0.05)] disabled:opacity-80"
        >
          <RefreshCw size={18} className={isSyncing ? "animate-spin text-[#3DA9E0]" : "text-white/70"} />
          <span>{isSyncing ? 'Syncing...' : 'Sync from Directory'}</span>
        </button>
      </header>

      {/* Info Banner */}
      <div className="p-4 rounded-xl bg-[#3DA9E0]/10 border border-[#3DA9E0]/20 flex items-start gap-3 backdrop-blur-sm">
        <Info className="text-[#3DA9E0] shrink-0 mt-0.5" size={20} />
        <div>
          <p className="text-[#3DA9E0] font-medium text-sm">Department Admins can manage their own pages.</p>
          <p className="text-[#3DA9E0]/70 text-sm mt-1">If a department has a linked page, the assigned department admins can edit its content inside BISO OS. You can also filter these in the Pages overview.</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={18} />
          <input 
            type="text" 
            placeholder="Search departments..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-3 text-white placeholder:text-white/40 outline-none focus:border-[#3DA9E0] transition-colors backdrop-blur-sm"
          />
        </div>
        <div className="flex gap-3 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 hide-scrollbar">
          {['All Types', 'Board', 'Committee', 'Project', 'Staff'].map((type) => (
            <button key={type} className={`px-5 py-2 rounded-full border text-sm whitespace-nowrap transition-all ${type === 'All Types' ? 'border-[#3DA9E0]/30 bg-[#3DA9E0]/10 text-[#3DA9E0]' : 'border-white/10 text-white/60 hover:bg-white/5 hover:text-white'}`}>
              {type}
            </button>
          ))}
          <button className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-white/80 text-sm hover:bg-white/10 transition-all">
            <Filter size={14} /> Campus
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        <AnimatePresence>
          {DEPARTMENTS.filter(d => d.name.toLowerCase().includes(search.toLowerCase())).map((dept, i) => (
            <motion.div
              layout
              key={dept.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-3xl bg-white/[0.02] border border-white/[0.05] overflow-hidden group flex flex-col backdrop-blur-sm relative"
            >
              {/* Top Cover */}
              <div className="h-32 relative overflow-hidden bg-[#001731]">
                <img 
                  src={dept.image} 
                  alt={dept.name}
                  className="w-full h-full object-cover opacity-40 group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#000a16] via-transparent to-transparent" />
                <div className="absolute top-4 left-4 flex gap-2">
                  <span className={`px-2.5 py-1 rounded-md text-[10px] uppercase tracking-wider font-semibold border backdrop-blur-md ${
                    dept.type === 'Board' ? 'bg-[#3DA9E0]/20 text-[#3DA9E0] border-[#3DA9E0]/30' :
                    dept.type === 'Committee' ? 'bg-emerald-400/20 text-emerald-400 border-emerald-400/30' :
                    dept.type === 'Project' ? 'bg-amber-400/20 text-amber-400 border-amber-400/30' :
                    'bg-white/10 text-white/90 border-white/20'
                  }`}>
                    {dept.type}
                  </span>
                </div>
                <div className="absolute top-4 right-4 text-[10px] text-white/40 font-mono flex items-center gap-1 bg-black/40 px-2 py-1 rounded border border-white/10 backdrop-blur-md">
                  <Shield size={10} /> Ext. ID: {dept.id}
                </div>
              </div>

              {/* Content */}
              <div className="p-6 flex-1 flex flex-col relative z-10 -mt-6">
                <div className="bg-[#000a16]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-5 mb-4 shadow-xl">
                  <h3 className="text-xl font-medium text-white mb-1">{dept.name}</h3>
                  <div className="flex items-center gap-4 text-xs text-white/50 mb-4 font-mono mt-1">
                    <span className="flex items-center gap-1.5"><MapPin size={12} className="text-[#3DA9E0]" /> {dept.campus}</span>
                    <span className="flex items-center gap-1.5"><Users size={12} className="text-[#3DA9E0]" /> {dept.memberCount} Members</span>
                  </div>
                  
                  <div className="flex items-center gap-2 bg-white/5 border border-white/5 rounded-lg p-2.5">
                    <Globe size={14} className="text-white/40 shrink-0" />
                    <span className="text-white/60 text-xs font-mono truncate">{dept.slug}</span>
                  </div>
                </div>

                <div className="mt-auto">
                  {dept.pageId ? (
                    <div className="grid grid-cols-2 gap-3">
                      <Link 
                        to={`/editor/${dept.pageId}`}
                        className="flex items-center justify-center gap-2 py-3 rounded-xl bg-white/10 border border-white/10 text-white font-medium hover:bg-white/20 transition-all text-sm"
                      >
                        <Edit3 size={16} /> Edit Page
                      </Link>
                      <button className="flex items-center justify-center gap-2 py-3 rounded-xl border border-[#3DA9E0]/30 text-[#3DA9E0] font-medium hover:bg-[#3DA9E0]/10 transition-all text-sm">
                        <Users size={16} /> Admins
                      </button>
                    </div>
                  ) : (
                    <Link 
                      to={`/editor/new?department=${dept.id}`}
                      className="flex items-center justify-center gap-2 py-3 rounded-xl bg-[#3DA9E0]/10 border border-[#3DA9E0]/30 text-[#3DA9E0] font-medium hover:bg-[#3DA9E0]/20 transition-all shadow-[0_0_15px_rgba(61,169,224,0.1)] group-hover:shadow-[0_0_20px_rgba(61,169,224,0.2)] text-sm"
                    >
                      <Plus size={16} /> Initialize Page
                    </Link>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
