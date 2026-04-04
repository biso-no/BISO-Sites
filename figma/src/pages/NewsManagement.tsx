import {
  Calendar,
  FileText,
  Filter,
  MoreHorizontal,
  PenTool,
  Plus,
  Search,
} from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { Link } from "react-router";

const MOCK_NEWS = [
  {
    id: "1",
    title: "BISO launches new AI-driven campus platform",
    author: "Alex Editor",
    category: "Technology",
    publishedAt: "2 hours ago",
    status: "published",
    reads: 1205,
    image:
      "https://images.unsplash.com/photo-1762793194390-4eaf3673f045?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxuZXdzcGFwZXIlMjBhcnRpY2xlJTIwbW9kZXJuJTIwZGFya3xlbnwxfHx8fDE3NzUyOTMwODB8MA&ixlib=rb-4.1.0&q=80&w=1080",
  },
  {
    id: "2",
    title: "Student Election Results 2026: A New Era",
    author: "Sarah Jenkins",
    category: "Campus Politics",
    publishedAt: "Yesterday",
    status: "published",
    reads: 4500,
    image:
      "https://images.unsplash.com/photo-1632834380561-d1e05839a33a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx1bml2ZXJzaXR5JTIwY2FtcHVzJTIwc3R1ZGVudHN8ZW58MXx8fHwxNzc1Mjg5MTQ3fDA&ixlib=rb-4.1.0&q=80&w=1080",
  },
];

export function NewsManagement() {
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
            News & Editorial
          </h1>
          <p className="mt-2 text-lg text-white/50">
            Shape the narrative. Publish articles and updates.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Link
            className="flex items-center gap-2 rounded-full bg-[#3DA9E0] px-6 py-3 font-semibold text-[#001731] shadow-[0_0_20px_rgba(61,169,224,0.3)] transition-all hover:shadow-[0_0_30px_rgba(61,169,224,0.5)]"
            to="/news/new"
          >
            <Plus size={18} />
            <span>Write Article</span>
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
            placeholder="Search articles..."
            type="text"
            value={search}
          />
        </div>
        <div className="hide-scrollbar flex w-full gap-3 overflow-x-auto pb-2 md:w-auto md:pb-0">
          {["Published", "Drafts", "Scheduled"].map((status) => (
            <button
              className="whitespace-nowrap rounded-full border border-white/10 px-5 py-2 text-sm text-white/60 transition-all hover:bg-white/5 hover:text-white"
              key={status}
            >
              {status}
            </button>
          ))}
          <button className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition-all hover:bg-white/10">
            <Filter size={14} /> Categories
          </button>
        </div>
      </div>

      {/* Articles List */}
      <div className="space-y-4">
        {MOCK_NEWS.map((article, i) => (
          <motion.div
            animate={{ opacity: 1, x: 0 }}
            className="group flex flex-col items-start justify-between rounded-3xl border border-white/[0.05] bg-white/[0.02] p-4 transition-all duration-300 hover:bg-white/[0.04] md:flex-row md:items-center md:p-6"
            initial={{ opacity: 0, x: -10 }}
            key={article.id}
            transition={{ delay: i * 0.1 }}
          >
            <div className="flex w-full flex-col items-start gap-6 md:w-auto md:flex-row md:items-center">
              <div className="h-48 w-full shrink-0 overflow-hidden rounded-2xl border border-white/10 md:h-24 md:w-40">
                <img
                  alt={article.title}
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  src={article.image}
                />
              </div>
              <div className="flex-1">
                <div className="mb-2 flex items-center gap-3">
                  <span className="font-bold text-[#3DA9E0] text-[10px] uppercase tracking-widest">
                    {article.category}
                  </span>
                  <span className="h-1 w-1 rounded-full bg-white/20" />
                  <span className="flex items-center gap-1 text-[10px] text-white/40 uppercase tracking-widest">
                    <Calendar size={10} /> {article.publishedAt}
                  </span>
                </div>
                <Link
                  className="mb-2 block font-serif text-white text-xl transition-colors group-hover:text-[#3DA9E0] md:text-2xl"
                  to={`/news/${article.id}`}
                >
                  {article.title}
                </Link>
                <div className="flex items-center gap-4 text-sm text-white/50">
                  <span className="flex items-center gap-1.5">
                    <PenTool size={14} /> {article.author}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <FileText size={14} /> {article.reads} reads
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 flex w-full items-center justify-end gap-4 border-white/5 border-t pt-4 md:mt-0 md:w-auto md:border-t-0 md:pt-0">
              <span className="rounded-full border border-[#3DA9E0]/30 bg-[#3DA9E0]/10 px-3 py-1 font-semibold text-[#3DA9E0] text-[11px] uppercase tracking-wider">
                {article.status}
              </span>
              <button className="rounded-lg border border-white/5 p-2 text-white/40 transition-all hover:border-white/20 hover:bg-white/10 hover:text-white">
                <MoreHorizontal size={18} />
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
