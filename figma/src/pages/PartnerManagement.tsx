import {
  Activity,
  AlertCircle,
  Building2,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Copy,
  Filter,
  Key,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  TerminalSquare,
  Webhook,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Link } from "react-router";

const PARTNERS = [
  {
    id: "p1",
    name: "Espresso House",
    status: "Active",
    apiStatus: "Healthy",
    benefitsLive: 1,
    totalClaims: "12.4k",
    lastSync: "10 mins ago",
    apiKeyPrefix: "sk_live_eHouse...",
  },
  {
    id: "p2",
    name: "SATS",
    status: "Active",
    apiStatus: "Healthy",
    benefitsLive: 2,
    totalClaims: "5.1k",
    lastSync: "1 hour ago",
    apiKeyPrefix: "sk_live_sats...",
  },
  {
    id: "p3",
    name: "Akademika",
    status: "Active",
    apiStatus: "Degraded",
    benefitsLive: 3,
    totalClaims: "8.2k",
    lastSync: "2 days ago",
    apiKeyPrefix: "sk_live_akad...",
  },
  {
    id: "p4",
    name: "Foodora",
    status: "Onboarding",
    apiStatus: "Pending",
    benefitsLive: 0,
    totalClaims: "0",
    lastSync: "Never",
    apiKeyPrefix: "Not generated",
  },
];

export function PartnerManagement() {
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (id: string) => {
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-6xl space-y-8 pb-12"
      initial={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.5 }}
    >
      <header className="sticky top-0 z-20 -mt-4 flex flex-col justify-between gap-6 border-white/10 border-b bg-[#000a16]/90 pt-4 pb-6 backdrop-blur-xl md:flex-row md:items-end">
        <div className="flex items-center gap-4">
          <Link
            className="rounded-lg p-2 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
            to="/benefits"
          >
            <ChevronLeft size={20} />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-light text-3xl text-white tracking-tight md:text-4xl">
                Partner Integrations
              </h1>
              <span className="rounded-full border border-[#3DA9E0]/30 bg-[#3DA9E0]/10 px-3 py-1 font-bold font-mono text-[#3DA9E0] text-xs">
                API Beta
              </span>
            </div>
            <p className="mt-1 text-sm text-white/50">
              Manage API keys, webhooks, and access for external benefit
              providers.
            </p>
          </div>
        </div>
        <button className="flex items-center gap-2 rounded-xl bg-[#3DA9E0] px-6 py-3 font-semibold text-[#001731] shadow-[0_0_20px_rgba(61,169,224,0.3)] transition-all hover:shadow-[0_0_30px_rgba(61,169,224,0.5)]">
          <Plus size={18} />
          <span>Invite Partner</span>
        </button>
      </header>

      {/* System Metrics */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="relative flex flex-col justify-center overflow-hidden rounded-3xl border border-white/5 bg-white/2 p-6 backdrop-blur-sm">
          <div className="absolute top-0 right-0 h-32 w-32 translate-x-1/2 -translate-y-1/2 rounded-full bg-[#3DA9E0]/5 blur-2xl" />
          <div className="mb-2 flex items-center gap-3">
            <Building2 className="text-[#3DA9E0]" size={20} />
            <h3 className="font-medium text-sm text-white/60 uppercase tracking-wider">
              Active Partners
            </h3>
          </div>
          <p className="font-light text-4xl text-white">12</p>
        </div>
        <div className="relative flex flex-col justify-center overflow-hidden rounded-3xl border border-white/5 bg-white/2 p-6 backdrop-blur-sm">
          <div className="absolute top-0 right-0 h-32 w-32 translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400/5 blur-2xl" />
          <div className="mb-2 flex items-center gap-3">
            <Activity className="text-emerald-400" size={20} />
            <h3 className="font-medium text-sm text-white/60 uppercase tracking-wider">
              API Health
            </h3>
          </div>
          <p className="font-light text-4xl text-white">99.9%</p>
        </div>
        <div className="relative flex flex-col justify-center overflow-hidden rounded-3xl border border-white/5 bg-white/2 p-6 backdrop-blur-sm">
          <div className="absolute top-0 right-0 h-32 w-32 translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-400/5 blur-2xl" />
          <div className="mb-2 flex items-center gap-3">
            <TerminalSquare className="text-purple-400" size={20} />
            <h3 className="font-medium text-sm text-white/60 uppercase tracking-wider">
              Total Requests (24h)
            </h3>
          </div>
          <p className="font-light text-4xl text-white">42.8k</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col items-center justify-between gap-4 pt-4 md:flex-row">
        <div className="relative w-full md:w-96">
          <Search
            className="absolute top-1/2 left-4 -translate-y-1/2 text-white/40"
            size={18}
          />
          <input
            className="w-full rounded-2xl border border-white/10 bg-white/5 py-3 pr-4 pl-12 text-sm text-white outline-none backdrop-blur-sm transition-colors placeholder:text-white/40 focus:border-[#3DA9E0]"
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search partners or API keys..."
            type="text"
            value={search}
          />
        </div>
        <div className="hide-scrollbar flex w-full gap-3 overflow-x-auto pb-2 md:w-auto md:pb-0">
          <button className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-white/80 transition-all hover:bg-white/5">
            <Filter size={14} /> Filter Status
          </button>
          <button className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition-all hover:bg-white/10">
            <RefreshCw size={14} /> Sync Logs
          </button>
        </div>
      </div>

      {/* Partners List */}
      <div className="space-y-4">
        <AnimatePresence>
          {PARTNERS.filter((p) =>
            p.name.toLowerCase().includes(search.toLowerCase())
          ).map((partner, i) => (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="group flex flex-col justify-between gap-6 rounded-3xl border border-white/5 bg-white/2 p-6 backdrop-blur-sm transition-colors hover:bg-white/4 xl:flex-row xl:items-center"
              initial={{ opacity: 0, y: 10 }}
              key={partner.id}
              layout
              transition={{ delay: i * 0.05 }}
            >
              {/* Info Section */}
              <div className="flex items-center gap-5 xl:w-1/3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 shadow-inner">
                  <Building2 className="text-white/50" size={24} />
                </div>
                <div>
                  <h3 className="mb-1 flex items-center gap-2 font-medium text-white text-xl">
                    {partner.name}
                    {partner.status === "Active" && (
                      <ShieldCheck className="text-[#3DA9E0]" size={16} />
                    )}
                  </h3>
                  <div className="flex items-center gap-3 text-xs">
                    <span
                      className={`rounded border px-2 py-0.5 font-medium uppercase tracking-wide ${
                        partner.status === "Active"
                          ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-400"
                          : "border-amber-400/20 bg-amber-400/10 text-amber-400"
                      }`}
                    >
                      {partner.status}
                    </span>
                    <span className="flex items-center gap-1 text-white/40">
                      <Clock size={12} /> Last sync: {partner.lastSync}
                    </span>
                  </div>
                </div>
              </div>

              {/* Stats Section */}
              <div className="grid grid-cols-2 gap-4 border-white/5 border-y py-4 xl:w-1/4 xl:border-x xl:border-y-0 xl:px-6 xl:py-0">
                <div>
                  <p className="mb-1 text-[10px] text-white/40 uppercase tracking-widest">
                    Live Benefits
                  </p>
                  <p className="font-mono text-lg text-white">
                    {partner.benefitsLive}
                  </p>
                </div>
                <div>
                  <p className="mb-1 text-[10px] text-white/40 uppercase tracking-widest">
                    Total Claims
                  </p>
                  <p className="font-mono text-lg text-white">
                    {partner.totalClaims}
                  </p>
                </div>
              </div>

              {/* API Section */}
              <div className="flex-1 space-y-3">
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-[10px] text-white/40 uppercase tracking-widest">
                    API Configuration
                  </p>
                  <span
                    className={`flex items-center gap-1 font-bold text-[10px] uppercase tracking-wider ${
                      partner.apiStatus === "Healthy"
                        ? "text-emerald-400"
                        : partner.apiStatus === "Degraded"
                          ? "text-amber-400"
                          : "text-white/40"
                    }`}
                  >
                    {partner.apiStatus === "Healthy" && (
                      <CheckCircle2 size={12} />
                    )}
                    {partner.apiStatus === "Degraded" && (
                      <AlertCircle size={12} />
                    )}
                    {partner.apiStatus}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex flex-1 items-center gap-3 rounded-xl border border-white/10 bg-[#000a16] p-2.5">
                    <Key className="shrink-0 text-white/30" size={14} />
                    <code className="flex-1 truncate text-white/70 text-xs">
                      {partner.apiKeyPrefix}
                    </code>
                    <button
                      className="p-1 text-white/40 transition-colors hover:text-white"
                      onClick={() => handleCopy(partner.id)}
                    >
                      {copiedId === partner.id ? (
                        <CheckCircle2 className="text-emerald-400" size={14} />
                      ) : (
                        <Copy size={14} />
                      )}
                    </button>
                  </div>
                  <button
                    className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
                    title="Configure Webhooks"
                  >
                    <Webhook size={18} />
                  </button>
                </div>

                {partner.status === "Active" ? (
                  <div className="flex gap-2">
                    <button className="rounded bg-white/5 px-2 py-1 font-medium text-[11px] text-white/40 transition-colors hover:text-white">
                      Roll API Key
                    </button>
                    <button className="rounded bg-red-500/10 px-2 py-1 font-medium text-[11px] text-red-400 transition-colors hover:text-red-300">
                      Revoke Access
                    </button>
                  </div>
                ) : (
                  <button className="rounded bg-[#3DA9E0]/10 px-2 py-1 font-medium text-[#3DA9E0] text-[11px] transition-colors hover:text-white">
                    Generate Credentials
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
