import {
  Edit3,
  Filter,
  Globe,
  Info,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Users,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Link } from "react-router";

// Mock Data for externally synced departments
const DEPARTMENTS = [
  {
    id: "dept_1",
    name: "National Board",
    type: "Board",
    campus: "National",
    memberCount: 8,
    pageId: "pg_124",
    slug: "/departments/national-board",
    lastSynced: "2 mins ago",
    image:
      "https://images.unsplash.com/photo-1517048676732-d65bc937f952?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtZWV0aW5nJTIwYm9hcmRyb29tJTIwZGFya3xlbnwxfHx8fDE3NzUyOTUwNTl8MA&ixlib=rb-4.1.0&q=80&w=1080",
  },
  {
    id: "dept_2",
    name: "BISO Event Oslo",
    type: "Committee",
    campus: "Oslo",
    memberCount: 45,
    pageId: "pg_123",
    slug: "/departments/biso-event-oslo",
    lastSynced: "2 mins ago",
    image:
      "https://images.unsplash.com/photo-1540575467063-178a50c2df87?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjcm93ZCUyMGV2ZW50JTIwbmlnaHR8ZW58MXx8fHwxNzc1Mjk1MDU5fDA&ixlib=rb-4.1.0&q=80&w=1080",
  },
  {
    id: "dept_3",
    name: "BISO HR",
    type: "Staff",
    campus: "National",
    memberCount: 12,
    pageId: null, // No page created yet
    slug: "/departments/biso-hr",
    lastSynced: "2 mins ago",
    image:
      "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxvZmZpY2UlMjB3b3Jrc3BhY2UlMjBwZW9wbGV8ZW58MXx8fHwxNzc1Mjk1MDU5fDA&ixlib=rb-4.1.0&q=80&w=1080",
  },
  {
    id: "dept_4",
    name: "Fadderullan Bergen",
    type: "Project",
    campus: "Bergen",
    memberCount: 150,
    pageId: "pg_125",
    slug: "/departments/fadderullan-bergen",
    lastSynced: "2 mins ago",
    image:
      "https://images.unsplash.com/photo-1528605248644-14dd04022da1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzdHVkZW50cyUyMHBhcnR5fGVufDF8fHx8MTc3NTI5NTA1OXww&ixlib=rb-4.1.0&q=80&w=1080",
  },
  {
    id: "dept_5",
    name: "BISO Finance",
    type: "Staff",
    campus: "National",
    memberCount: 6,
    pageId: null,
    slug: "/departments/biso-finance",
    lastSynced: "2 mins ago",
    image:
      "https://images.unsplash.com/photo-1460925895917-afdab827c52f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmaW5hbmNlJTIwc3RhdHMlMjBkYXJrfGVufDF8fHx8MTc3NTI5NTIwNnww&ixlib=rb-4.1.0&q=80&w=1080",
  },
];

export function DepartmentManagement() {
  const [search, setSearch] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = () => {
    setIsSyncing(true);
    setTimeout(() => setIsSyncing(false), 2000);
  };

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 pb-12"
      initial={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.5 }}
    >
      <header className="flex flex-col justify-between gap-6 pt-4 md:flex-row md:items-end">
        <div>
          <h1 className="flex items-center gap-4 font-light text-4xl text-white tracking-tight md:text-5xl">
            Departments
            <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 font-mono text-white/50 text-xs uppercase tracking-widest">
              Read-Only Source
            </span>
          </h1>
          <p className="mt-2 text-lg text-white/50">
            Synced from external directory. Manage their dedicated CMS pages
            below.
          </p>
        </div>
        <button
          className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-6 py-3 font-medium text-white shadow-[0_0_20px_rgba(255,255,255,0.05)] transition-all hover:bg-white/10 disabled:opacity-80"
          disabled={isSyncing}
          onClick={handleSync}
        >
          <RefreshCw
            className={
              isSyncing ? "animate-spin text-[#3DA9E0]" : "text-white/70"
            }
            size={18}
          />
          <span>{isSyncing ? "Syncing..." : "Sync from Directory"}</span>
        </button>
      </header>

      {/* Info Banner */}
      <div className="flex items-start gap-3 rounded-xl border border-[#3DA9E0]/20 bg-[#3DA9E0]/10 p-4 backdrop-blur-sm">
        <Info className="mt-0.5 shrink-0 text-[#3DA9E0]" size={20} />
        <div>
          <p className="font-medium text-[#3DA9E0] text-sm">
            Department Admins can manage their own pages.
          </p>
          <p className="mt-1 text-[#3DA9E0]/70 text-sm">
            If a department has a linked page, the assigned department admins
            can edit its content inside BISO OS. You can also filter these in
            the Pages overview.
          </p>
        </div>
      </div>

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
            placeholder="Search departments..."
            type="text"
            value={search}
          />
        </div>
        <div className="hide-scrollbar flex w-full gap-3 overflow-x-auto pb-2 md:w-auto md:pb-0">
          {["All Types", "Board", "Committee", "Project", "Staff"].map(
            (type) => (
              <button
                className={`whitespace-nowrap rounded-full border px-5 py-2 text-sm transition-all ${type === "All Types" ? "border-[#3DA9E0]/30 bg-[#3DA9E0]/10 text-[#3DA9E0]" : "border-white/10 text-white/60 hover:bg-white/5 hover:text-white"}`}
                key={type}
              >
                {type}
              </button>
            )
          )}
          <button className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition-all hover:bg-white/10">
            <Filter size={14} /> Campus
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <AnimatePresence>
          {DEPARTMENTS.filter((d) =>
            d.name.toLowerCase().includes(search.toLowerCase())
          ).map((dept, i) => (
            <motion.div
              animate={{ opacity: 1, scale: 1 }}
              className="group relative flex flex-col overflow-hidden rounded-3xl border border-white/[0.05] bg-white/[0.02] backdrop-blur-sm"
              initial={{ opacity: 0, scale: 0.95 }}
              key={dept.id}
              layout
              transition={{ delay: i * 0.05 }}
            >
              {/* Top Cover */}
              <div className="relative h-32 overflow-hidden bg-[#001731]">
                <img
                  alt={dept.name}
                  className="h-full w-full object-cover opacity-40 transition-transform duration-700 group-hover:scale-105"
                  src={dept.image}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#000a16] via-transparent to-transparent" />
                <div className="absolute top-4 left-4 flex gap-2">
                  <span
                    className={`rounded-md border px-2.5 py-1 font-semibold text-[10px] uppercase tracking-wider backdrop-blur-md ${
                      dept.type === "Board"
                        ? "border-[#3DA9E0]/30 bg-[#3DA9E0]/20 text-[#3DA9E0]"
                        : dept.type === "Committee"
                          ? "border-emerald-400/30 bg-emerald-400/20 text-emerald-400"
                          : dept.type === "Project"
                            ? "border-amber-400/30 bg-amber-400/20 text-amber-400"
                            : "border-white/20 bg-white/10 text-white/90"
                    }`}
                  >
                    {dept.type}
                  </span>
                </div>
                <div className="absolute top-4 right-4 flex items-center gap-1 rounded border border-white/10 bg-black/40 px-2 py-1 font-mono text-[10px] text-white/40 backdrop-blur-md">
                  <Shield size={10} /> Ext. ID: {dept.id}
                </div>
              </div>

              {/* Content */}
              <div className="relative z-10 -mt-6 flex flex-1 flex-col p-6">
                <div className="mb-4 rounded-2xl border border-white/10 bg-[#000a16]/90 p-5 shadow-xl backdrop-blur-xl">
                  <h3 className="mb-1 font-medium text-white text-xl">
                    {dept.name}
                  </h3>
                  <div className="mt-1 mb-4 flex items-center gap-4 font-mono text-white/50 text-xs">
                    <span className="flex items-center gap-1.5">
                      <MapPin className="text-[#3DA9E0]" size={12} />{" "}
                      {dept.campus}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Users className="text-[#3DA9E0]" size={12} />{" "}
                      {dept.memberCount} Members
                    </span>
                  </div>

                  <div className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/5 p-2.5">
                    <Globe className="shrink-0 text-white/40" size={14} />
                    <span className="truncate font-mono text-white/60 text-xs">
                      {dept.slug}
                    </span>
                  </div>
                </div>

                <div className="mt-auto">
                  {dept.pageId ? (
                    <div className="grid grid-cols-2 gap-3">
                      <Link
                        className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/10 py-3 font-medium text-sm text-white transition-all hover:bg-white/20"
                        to={`/editor/${dept.pageId}`}
                      >
                        <Edit3 size={16} /> Edit Page
                      </Link>
                      <button className="flex items-center justify-center gap-2 rounded-xl border border-[#3DA9E0]/30 py-3 font-medium text-[#3DA9E0] text-sm transition-all hover:bg-[#3DA9E0]/10">
                        <Users size={16} /> Admins
                      </button>
                    </div>
                  ) : (
                    <Link
                      className="flex items-center justify-center gap-2 rounded-xl border border-[#3DA9E0]/30 bg-[#3DA9E0]/10 py-3 font-medium text-[#3DA9E0] text-sm shadow-[0_0_15px_rgba(61,169,224,0.1)] transition-all hover:bg-[#3DA9E0]/20 group-hover:shadow-[0_0_20px_rgba(61,169,224,0.2)]"
                      to={`/editor/new?department=${dept.id}`}
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
