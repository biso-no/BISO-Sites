import { useState } from "react";
import { Link } from "react-router";
import { motion } from "motion/react";
import { Plus, Search, Filter, MoreHorizontal, FileText, Calendar, PenTool } from "lucide-react";

const MOCK_NEWS = [
  {
    id: '1',
    title: 'BISO launches new AI-driven campus platform',
    author: 'Alex Editor',
    category: 'Technology',
    publishedAt: '2 hours ago',
    status: 'published',
    reads: 1205,
    image: 'https://images.unsplash.com/photo-1762793194390-4eaf3673f045?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxuZXdzcGFwZXIlMjBhcnRpY2xlJTIwbW9kZXJuJTIwZGFya3xlbnwxfHx8fDE3NzUyOTMwODB8MA&ixlib=rb-4.1.0&q=80&w=1080'
  },
  {
    id: '2',
    title: 'Student Election Results 2026: A New Era',
    author: 'Sarah Jenkins',
    category: 'Campus Politics',
    publishedAt: 'Yesterday',
    status: 'published',
    reads: 4500,
    image: 'https://images.unsplash.com/photo-1632834380561-d1e05839a33a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx1bml2ZXJzaXR5JTIwY2FtcHVzJTIwc3R1ZGVudHN8ZW58MXx8fHwxNzc1Mjg5MTQ3fDA&ixlib=rb-4.1.0&q=80&w=1080'
  }
];

export function NewsManagement() {
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
            News & Editorial
          </h1>
          <p className="text-white/50 mt-2 text-lg">Shape the narrative. Publish articles and updates.</p>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/news/new" className="flex items-center gap-2 px-6 py-3 rounded-full bg-[#3DA9E0] text-[#001731] font-semibold shadow-[0_0_20px_rgba(61,169,224,0.3)] hover:shadow-[0_0_30px_rgba(61,169,224,0.5)] transition-all">
            <Plus size={18} />
            <span>Write Article</span>
          </Link>
        </div>
      </header>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={18} />
          <input 
            type="text" 
            placeholder="Search articles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-3 text-white placeholder:text-white/40 outline-none focus:border-[#3DA9E0] transition-colors backdrop-blur-sm"
          />
        </div>
        <div className="flex gap-3 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 hide-scrollbar">
          {['Published', 'Drafts', 'Scheduled'].map((status) => (
            <button key={status} className="px-5 py-2 rounded-full border border-white/10 text-white/60 text-sm whitespace-nowrap hover:bg-white/5 hover:text-white transition-all">
              {status}
            </button>
          ))}
          <button className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-white/80 text-sm hover:bg-white/10 transition-all">
            <Filter size={14} /> Categories
          </button>
        </div>
      </div>

      {/* Articles List */}
      <div className="space-y-4">
        {MOCK_NEWS.map((article, i) => (
          <motion.div
            key={article.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="group flex flex-col md:flex-row items-start md:items-center justify-between p-4 md:p-6 rounded-3xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] transition-all duration-300"
          >
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6 w-full md:w-auto">
              <div className="w-full md:w-40 h-48 md:h-24 rounded-2xl overflow-hidden shrink-0 border border-white/10">
                <img src={article.image} alt={article.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-[10px] uppercase tracking-widest text-[#3DA9E0] font-bold">{article.category}</span>
                  <span className="w-1 h-1 rounded-full bg-white/20" />
                  <span className="text-[10px] uppercase tracking-widest text-white/40 flex items-center gap-1"><Calendar size={10} /> {article.publishedAt}</span>
                </div>
                <Link to={`/news/${article.id}`} className="text-xl md:text-2xl font-serif text-white group-hover:text-[#3DA9E0] transition-colors mb-2 block">
                  {article.title}
                </Link>
                <div className="flex items-center gap-4 text-sm text-white/50">
                  <span className="flex items-center gap-1.5"><PenTool size={14} /> {article.author}</span>
                  <span className="flex items-center gap-1.5"><FileText size={14} /> {article.reads} reads</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 mt-4 md:mt-0 pt-4 md:pt-0 border-t md:border-t-0 border-white/5 w-full md:w-auto justify-end">
              <span className="px-3 py-1 rounded-full bg-[#3DA9E0]/10 border border-[#3DA9E0]/30 text-[#3DA9E0] text-[11px] font-semibold tracking-wider uppercase">
                {article.status}
              </span>
              <button className="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-all border border-white/5 hover:border-white/20">
                <MoreHorizontal size={18} />
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
