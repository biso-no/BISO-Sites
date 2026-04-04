import {
  Coffee,
  ExternalLink,
  Filter,
  Gift,
  Globe,
  MapPin,
  Percent,
  Plus,
  Search,
  ShieldCheck,
  Ticket,
  Zap,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Link } from "react-router";

const BENEFITS = [
  {
    id: "1",
    title: "20% Off All Beverages",
    provider: "Espresso House",
    type: "Discount",
    scope: "National",
    status: "Active",
    uses: "12.4k",
    isPartnerSynced: true,
    image:
      "https://images.unsplash.com/photo-1554118811-1e0d58224f24?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb2ZmZWUlMjBzaG9wfGVufDF8fHx8MTc3NTI5NjAwMHww&ixlib=rb-4.1.0&q=80&w=1080",
  },
  {
    id: "2",
    title: "Free Tuesday Lunch",
    provider: "BISO Campus",
    type: "Service",
    scope: "Oslo",
    status: "Active",
    uses: "850",
    isPartnerSynced: false,
    image:
      "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdW5jaCUyMGZvb2R8ZW58MXx8fHwxNzc1Mjk2MTEyfDA&ixlib=rb-4.1.0&q=80&w=1080",
  },
  {
    id: "3",
    title: "VIP Fast-Track Entry",
    provider: "Fadderullan",
    type: "Access",
    scope: "National",
    status: "Active",
    uses: "3.2k",
    isPartnerSynced: false,
    image:
      "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjbHViJTIwcGFydHl8ZW58MXx8fHwxNzc1Mjk2MTQ3fDA&ixlib=rb-4.1.0&q=80&w=1080",
  },
  {
    id: "4",
    title: "Free Exam Prep Course",
    provider: "BISO Academic",
    type: "Service",
    scope: "Bergen",
    status: "Scheduled",
    uses: "-",
    isPartnerSynced: false,
    image:
      "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzdHVkeSUyMGV4YW18ZW58MXx8fHwxNzc1Mjk2MTc5fDA&ixlib=rb-4.1.0&q=80&w=1080",
  },
  {
    id: "5",
    title: "30% Off Gym Memberships",
    provider: "SATS",
    type: "Discount",
    scope: "National",
    status: "Active",
    uses: "5.1k",
    isPartnerSynced: true,
    image:
      "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxneW18ZW58MXx8fHwxNzc1Mjk2MjA1fDA&ixlib=rb-4.1.0&q=80&w=1080",
  },
];

const TYPE_ICONS = {
  Discount: Percent,
  Service: Coffee,
  Access: Ticket,
  Other: Gift,
};

export function BenefitManagement() {
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");

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
            Member Benefits
          </h1>
          <p className="mt-2 text-lg text-white/50">
            Manage exclusive perks, discounts, and services for BISO members.
          </p>
        </div>
        <Link
          className="flex items-center gap-2 rounded-full bg-[#3DA9E0] px-6 py-3 font-semibold text-[#001731] shadow-[0_0_20px_rgba(61,169,224,0.3)] transition-all hover:shadow-[0_0_30px_rgba(61,169,224,0.5)]"
          to="/benefits/new"
        >
          <Plus size={18} />
          <span>Create Benefit</span>
        </Link>
      </header>

      {/* Partner Integration Banner */}
      <div className="group relative overflow-hidden rounded-2xl border border-[#3DA9E0]/30 bg-linear-to-br from-[#001731] to-[#000a16] p-6 shadow-[0_0_30px_rgba(61,169,224,0.1)] md:p-8">
        <div className="absolute top-0 right-0 h-64 w-64 rounded-full bg-[#3DA9E0]/10 blur-[80px] transition-all duration-700 group-hover:bg-[#3DA9E0]/20" />
        <div className="relative z-10 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#3DA9E0]/30 bg-[#3DA9E0]/10">
              <Zap className="text-[#3DA9E0]" size={24} />
            </div>
            <div>
              <h2 className="flex items-center gap-2 font-medium text-white text-xl">
                Partner API Integration{" "}
                <span className="rounded border border-[#3DA9E0]/30 bg-[#3DA9E0]/20 px-2 py-0.5 text-[#3DA9E0] text-[10px] uppercase tracking-wider">
                  Beta
                </span>
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-white/60 leading-relaxed">
                External partners can now automatically submit and manage their
                discounts via the BISO Partner API. Synced benefits require
                approval before going live to students.
              </p>
            </div>
          </div>
          <Link
            className="flex shrink-0 items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-5 py-2.5 font-medium text-sm text-white transition-all hover:bg-white/10"
            to="/benefits/partners"
          >
            <ExternalLink size={16} /> Manage Partners
          </Link>
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
            placeholder="Search benefits or providers..."
            type="text"
            value={search}
          />
        </div>
        <div className="hide-scrollbar flex w-full gap-3 overflow-x-auto pb-2 md:w-auto md:pb-0">
          {[
            "All",
            "National",
            "Campus Specific",
            "Active",
            "Partner Synced",
          ].map((filter) => (
            <button
              className={`whitespace-nowrap rounded-full border px-5 py-2 text-sm transition-all ${
                activeFilter === filter
                  ? "border-[#3DA9E0]/30 bg-[#3DA9E0]/10 text-[#3DA9E0]"
                  : "border-white/10 text-white/60 hover:bg-white/5 hover:text-white"
              }`}
              key={filter}
              onClick={() => setActiveFilter(filter)}
            >
              {filter}
            </button>
          ))}
          <button className="flex shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition-all hover:bg-white/10">
            <Filter size={14} /> Filters
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence>
          {BENEFITS.filter(
            (b) =>
              b.title.toLowerCase().includes(search.toLowerCase()) ||
              b.provider.toLowerCase().includes(search.toLowerCase())
          ).map((benefit, i) => {
            const TypeIcon =
              TYPE_ICONS[benefit.type as keyof typeof TYPE_ICONS] || Gift;

            return (
              <motion.div
                animate={{ opacity: 1, scale: 1 }}
                className="group relative flex flex-col overflow-hidden rounded-3xl border border-white/5 bg-white/2 backdrop-blur-sm"
                initial={{ opacity: 0, scale: 0.95 }}
                key={benefit.id}
                layout
                transition={{ delay: i * 0.05 }}
              >
                {/* Image Cover */}
                <div className="relative h-40 overflow-hidden bg-[#001731]">
                  <img
                    alt={benefit.title}
                    className="h-full w-full object-cover opacity-60 transition-transform duration-700 group-hover:scale-105 group-hover:opacity-80"
                    src={benefit.image}
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-[#000a16] via-[#000a16]/40 to-transparent" />

                  <div className="absolute top-4 left-4 flex gap-2">
                    <span
                      className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-semibold text-[10px] uppercase tracking-wider backdrop-blur-md ${
                        benefit.scope === "National"
                          ? "border-[#3DA9E0]/30 bg-[#3DA9E0]/20 text-[#3DA9E0]"
                          : "border-emerald-400/30 bg-emerald-400/20 text-emerald-400"
                      }`}
                    >
                      {benefit.scope === "National" ? (
                        <Globe size={12} />
                      ) : (
                        <MapPin size={12} />
                      )}
                      {benefit.scope}
                    </span>
                  </div>
                  <div className="absolute top-4 right-4">
                    <span
                      className={`rounded-full border px-2.5 py-1 font-bold text-[10px] uppercase tracking-wider backdrop-blur-md ${
                        benefit.status === "Active"
                          ? "border-emerald-400/30 bg-emerald-400/20 text-emerald-400"
                          : "border-amber-400/30 bg-amber-400/20 text-amber-400"
                      }`}
                    >
                      {benefit.status}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="relative z-10 -mt-6 flex flex-1 flex-col p-6">
                  <div className="mb-4 rounded-2xl border border-white/10 bg-[#000a16]/90 p-5 shadow-xl backdrop-blur-xl">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="flex items-center gap-1 font-mono text-white/50 text-xs uppercase tracking-wider">
                        <TypeIcon size={12} /> {benefit.type}
                      </span>
                      {benefit.isPartnerSynced && (
                        <span className="ml-auto flex items-center gap-1 font-bold text-[#3DA9E0] text-[10px] uppercase tracking-wider">
                          <ShieldCheck size={12} /> API Synced
                        </span>
                      )}
                    </div>
                    <h3 className="mb-1 line-clamp-1 font-medium text-white text-xl">
                      {benefit.title}
                    </h3>
                    <p className="font-medium text-[#3DA9E0] text-sm">
                      {benefit.provider}
                    </p>
                  </div>

                  <div className="mt-auto grid grid-cols-2 gap-3">
                    <div className="flex flex-col items-center justify-center rounded-xl border border-white/5 bg-white/5 p-3">
                      <span className="mb-1 text-[10px] text-white/40 uppercase tracking-widest">
                        Total Claims
                      </span>
                      <span className="font-mono text-white">
                        {benefit.uses}
                      </span>
                    </div>
                    <Link
                      className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/10 py-3 font-medium text-sm text-white transition-all hover:bg-white/20"
                      to={`/benefits/${benefit.id}`}
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
