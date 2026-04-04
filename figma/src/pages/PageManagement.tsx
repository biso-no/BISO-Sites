import { useState } from "react";
import { Link } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { Plus, Search, Filter, MoreHorizontal, Grid, List as ListIcon, Globe } from "lucide-react";
import { MOCK_PAGES } from "../data";

export function PageManagement() {
  const [view, setView] = useState<'grid' | 'list'>('grid');
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
            Pages
          </h1>
          <p className="text-white/50 mt-2 text-lg">Manage, create, and publish site content.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 backdrop-blur-sm">
            <button 
              onClick={() => setView('grid')}
              className={`p-2 rounded-lg transition-all ${view === 'grid' ? 'bg-white/10 text-white shadow-sm' : 'text-white/40 hover:text-white/80'}`}
            >
              <Grid size={18} />
            </button>
            <button 
              onClick={() => setView('list')}
              className={`p-2 rounded-lg transition-all ${view === 'list' ? 'bg-white/10 text-white shadow-sm' : 'text-white/40 hover:text-white/80'}`}
            >
              <ListIcon size={18} />
            </button>
          </div>
          <Link 
            to="/editor/new"
            className="flex items-center gap-2 px-6 py-3 rounded-full bg-[#3DA9E0] text-[#001731] font-semibold shadow-[0_0_20px_rgba(61,169,224,0.3)] hover:shadow-[0_0_30px_rgba(61,169,224,0.5)] transition-all"
          >
            <Plus size={18} />
            <span>Create Page</span>
          </Link>
        </div>
      </header>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={18} />
          <input 
            type="text" 
            placeholder="Search pages..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-3 text-white placeholder:text-white/40 outline-none focus:border-[#3DA9E0] transition-colors backdrop-blur-sm"
          />
        </div>
        <div className="flex gap-3 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 hide-scrollbar">
          {['All', 'Department Pages', 'Published', 'Draft', 'Review'].map((status) => (
            <button key={status} className={`px-5 py-2 rounded-full border text-sm whitespace-nowrap transition-all ${status === 'Department Pages' ? 'border-[#3DA9E0]/30 bg-[#3DA9E0]/10 text-[#3DA9E0]' : 'border-white/10 text-white/60 hover:bg-white/5 hover:text-white'}`}>
              {status}
            </button>
          ))}
          <button className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-white/80 text-sm hover:bg-white/10 transition-all">
            <Filter size={14} /> Filters
          </button>
        </div>
      </div>

      {/* Grid View */}
      <AnimatePresence mode="wait">
        {view === 'grid' ? (
          <motion.div 
            key="grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
          >
            {MOCK_PAGES.map((page, i) => (
              <motion.div 
                key={page.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="group flex flex-col rounded-3xl bg-white/[0.02] border border-white/[0.05] overflow-hidden hover:bg-white/[0.04] transition-all duration-300"
              >
                <Link to={`/editor/${page.id}`} className="block relative aspect-[4/3] overflow-hidden bg-[#001731]">
                  <img 
                    src={page.image} 
                    alt={page.title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-80 group-hover:opacity-100"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#000a16] via-transparent to-transparent opacity-80" />
                  
                  <div className="absolute top-4 left-4">
                    <StatusBadge status={page.status} />
                  </div>
                  
                  <div className="absolute top-4 right-4 bg-[#000a16]/80 backdrop-blur-md rounded-lg p-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer border border-white/10 hover:bg-white/10">
                    <MoreHorizontal size={16} className="text-white" />
                  </div>
                </Link>

                <div className="p-5 flex flex-col flex-1">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <Link to={`/editor/${page.id}`} className="text-lg font-medium text-white hover:text-[#3DA9E0] transition-colors line-clamp-1">
                        {page.title}
                      </Link>
                      <p className="text-white/40 text-sm mt-1 font-mono truncate">{page.slug}</p>
                    </div>
                  </div>
                  
                  <div className="mt-auto pt-4 border-t border-white/5 flex items-center justify-between text-xs text-white/40">
                    <span className="flex items-center gap-1.5"><Globe size={12}/> EN, NO</span>
                    <span>Edited {page.lastEdited}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <motion.div 
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="rounded-3xl border border-white/10 bg-white/[0.02] backdrop-blur-sm overflow-hidden"
          >
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-6 py-4 text-white/40 text-sm font-medium">Page Title</th>
                  <th className="px-6 py-4 text-white/40 text-sm font-medium">Status</th>
                  <th className="px-6 py-4 text-white/40 text-sm font-medium hidden md:table-cell">Author</th>
                  <th className="px-6 py-4 text-white/40 text-sm font-medium hidden lg:table-cell">Last Edited</th>
                  <th className="px-6 py-4 text-right text-white/40 text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_PAGES.map((page, i) => (
                  <tr key={page.id} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 hidden sm:block">
                          <img src={page.image} alt={page.title} className="w-full h-full object-cover opacity-80" />
                        </div>
                        <div>
                          <Link to={`/editor/${page.id}`} className="text-white font-medium hover:text-[#3DA9E0] transition-colors block">
                            {page.title}
                          </Link>
                          <span className="text-white/40 text-xs font-mono">{page.slug}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={page.status} />
                    </td>
                    <td className="px-6 py-4 hidden md:table-cell text-white/70 text-sm">{page.author}</td>
                    <td className="px-6 py-4 hidden lg:table-cell text-white/50 text-sm">{page.lastEdited}</td>
                    <td className="px-6 py-4 text-right">
                      <button className="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-all">
                        <MoreHorizontal size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        )}
      </AnimatePresence>
      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </motion.div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles = {
    published: "bg-[#3DA9E0]/10 text-[#3DA9E0] border-[#3DA9E0]/30 shadow-[0_0_10px_rgba(61,169,224,0.2)]",
    review: "bg-amber-400/10 text-amber-400 border-amber-400/30",
    draft: "bg-white/10 text-white/70 border-white/20",
  }[status] || "bg-white/10 text-white border-white/20";

  return (
    <span className={`px-3 py-1 text-[11px] font-semibold tracking-wider uppercase rounded-full border backdrop-blur-md flex items-center gap-1.5 w-fit ${styles}`}>
      {status === 'published' && <span className="w-1.5 h-1.5 rounded-full bg-[#3DA9E0] shadow-[0_0_5px_#3DA9E0]" />}
      {status === 'review' && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
      {status === 'draft' && <span className="w-1.5 h-1.5 rounded-full bg-white/50" />}
      {status}
    </span>
  );
}
