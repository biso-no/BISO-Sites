import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Link } from "react-router";
import { 
  ChevronLeft, Plus, Search, Filter, Copy, 
  RefreshCw, Building2, Key, Activity, 
  CheckCircle2, AlertCircle, Clock, ShieldCheck, 
  TerminalSquare, Webhook
} from "lucide-react";

const PARTNERS = [
  { 
    id: 'p1', 
    name: 'Espresso House', 
    status: 'Active', 
    apiStatus: 'Healthy', 
    benefitsLive: 1, 
    totalClaims: '12.4k', 
    lastSync: '10 mins ago',
    apiKeyPrefix: 'sk_live_eHouse...'
  },
  { 
    id: 'p2', 
    name: 'SATS', 
    status: 'Active', 
    apiStatus: 'Healthy', 
    benefitsLive: 2, 
    totalClaims: '5.1k', 
    lastSync: '1 hour ago',
    apiKeyPrefix: 'sk_live_sats...'
  },
  { 
    id: 'p3', 
    name: 'Akademika', 
    status: 'Active', 
    apiStatus: 'Degraded', 
    benefitsLive: 3, 
    totalClaims: '8.2k', 
    lastSync: '2 days ago',
    apiKeyPrefix: 'sk_live_akad...'
  },
  { 
    id: 'p4', 
    name: 'Foodora', 
    status: 'Onboarding', 
    apiStatus: 'Pending', 
    benefitsLive: 0, 
    totalClaims: '0', 
    lastSync: 'Never',
    apiKeyPrefix: 'Not generated'
  }
];

export function PartnerManagement() {
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (id: string) => {
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="max-w-6xl mx-auto space-y-8 pb-12"
    >
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pt-4 border-b border-white/10 pb-6 sticky top-0 bg-[#000a16]/90 backdrop-blur-xl z-20 -mt-4">
        <div className="flex items-center gap-4">
          <Link 
            to="/benefits"
            className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
          >
            <ChevronLeft size={20} />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl md:text-4xl font-light tracking-tight text-white">
                Partner Integrations
              </h1>
              <span className="px-3 py-1 rounded-full bg-[#3DA9E0]/10 text-[#3DA9E0] border border-[#3DA9E0]/30 text-xs font-bold font-mono">
                API Beta
              </span>
            </div>
            <p className="text-white/50 mt-1 text-sm">Manage API keys, webhooks, and access for external benefit providers.</p>
          </div>
        </div>
        <button className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#3DA9E0] text-[#001731] font-semibold shadow-[0_0_20px_rgba(61,169,224,0.3)] hover:shadow-[0_0_30px_rgba(61,169,224,0.5)] transition-all">
          <Plus size={18} />
          <span>Invite Partner</span>
        </button>
      </header>

      {/* System Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white/[0.02] border border-white/[0.05] rounded-3xl p-6 flex flex-col justify-center backdrop-blur-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#3DA9E0]/5 rounded-full blur-[40px] -translate-y-1/2 translate-x-1/2" />
          <div className="flex items-center gap-3 mb-2">
            <Building2 className="text-[#3DA9E0]" size={20} />
            <h3 className="text-white/60 font-medium text-sm uppercase tracking-wider">Active Partners</h3>
          </div>
          <p className="text-4xl font-light text-white">12</p>
        </div>
        <div className="bg-white/[0.02] border border-white/[0.05] rounded-3xl p-6 flex flex-col justify-center backdrop-blur-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-400/5 rounded-full blur-[40px] -translate-y-1/2 translate-x-1/2" />
          <div className="flex items-center gap-3 mb-2">
            <Activity className="text-emerald-400" size={20} />
            <h3 className="text-white/60 font-medium text-sm uppercase tracking-wider">API Health</h3>
          </div>
          <p className="text-4xl font-light text-white">99.9%</p>
        </div>
        <div className="bg-white/[0.02] border border-white/[0.05] rounded-3xl p-6 flex flex-col justify-center backdrop-blur-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-400/5 rounded-full blur-[40px] -translate-y-1/2 translate-x-1/2" />
          <div className="flex items-center gap-3 mb-2">
            <TerminalSquare className="text-purple-400" size={20} />
            <h3 className="text-white/60 font-medium text-sm uppercase tracking-wider">Total Requests (24h)</h3>
          </div>
          <p className="text-4xl font-light text-white">42.8k</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center pt-4">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={18} />
          <input 
            type="text" 
            placeholder="Search partners or API keys..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-3 text-white placeholder:text-white/40 outline-none focus:border-[#3DA9E0] transition-colors backdrop-blur-sm text-sm"
          />
        </div>
        <div className="flex gap-3 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 hide-scrollbar">
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-white/80 text-sm hover:bg-white/5 transition-all">
            <Filter size={14} /> Filter Status
          </button>
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/80 text-sm hover:bg-white/10 transition-all">
            <RefreshCw size={14} /> Sync Logs
          </button>
        </div>
      </div>

      {/* Partners List */}
      <div className="space-y-4">
        <AnimatePresence>
          {PARTNERS.filter(p => p.name.toLowerCase().includes(search.toLowerCase())).map((partner, i) => (
            <motion.div
              layout
              key={partner.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white/[0.02] border border-white/[0.05] rounded-3xl p-6 backdrop-blur-sm hover:bg-white/[0.04] transition-colors group flex flex-col xl:flex-row xl:items-center justify-between gap-6"
            >
              {/* Info Section */}
              <div className="flex items-center gap-5 xl:w-1/3">
                <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 shadow-inner">
                  <Building2 size={24} className="text-white/50" />
                </div>
                <div>
                  <h3 className="text-xl font-medium text-white mb-1 flex items-center gap-2">
                    {partner.name}
                    {partner.status === 'Active' && <ShieldCheck size={16} className="text-[#3DA9E0]" />}
                  </h3>
                  <div className="flex items-center gap-3 text-xs">
                    <span className={`px-2 py-0.5 rounded border font-medium tracking-wide uppercase ${
                      partner.status === 'Active' ? 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20' : 'bg-amber-400/10 text-amber-400 border-amber-400/20'
                    }`}>
                      {partner.status}
                    </span>
                    <span className="text-white/40 flex items-center gap-1">
                      <Clock size={12} /> Last sync: {partner.lastSync}
                    </span>
                  </div>
                </div>
              </div>

              {/* Stats Section */}
              <div className="grid grid-cols-2 gap-4 xl:w-1/4 border-y xl:border-y-0 xl:border-x border-white/5 py-4 xl:py-0 xl:px-6">
                <div>
                  <p className="text-white/40 text-[10px] uppercase tracking-widest mb-1">Live Benefits</p>
                  <p className="text-white font-mono text-lg">{partner.benefitsLive}</p>
                </div>
                <div>
                  <p className="text-white/40 text-[10px] uppercase tracking-widest mb-1">Total Claims</p>
                  <p className="text-white font-mono text-lg">{partner.totalClaims}</p>
                </div>
              </div>

              {/* API Section */}
              <div className="flex-1 space-y-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-white/40 text-[10px] uppercase tracking-widest">API Configuration</p>
                  <span className={`flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold ${
                    partner.apiStatus === 'Healthy' ? 'text-emerald-400' :
                    partner.apiStatus === 'Degraded' ? 'text-amber-400' :
                    'text-white/40'
                  }`}>
                    {partner.apiStatus === 'Healthy' && <CheckCircle2 size={12} />}
                    {partner.apiStatus === 'Degraded' && <AlertCircle size={12} />}
                    {partner.apiStatus}
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-[#000a16] border border-white/10 rounded-xl p-2.5 flex items-center gap-3">
                    <Key size={14} className="text-white/30 shrink-0" />
                    <code className="text-white/70 text-xs truncate flex-1">{partner.apiKeyPrefix}</code>
                    <button 
                      onClick={() => handleCopy(partner.id)}
                      className="text-white/40 hover:text-white transition-colors p-1"
                    >
                      {copiedId === partner.id ? <CheckCircle2 size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    </button>
                  </div>
                  <button className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 transition-colors" title="Configure Webhooks">
                    <Webhook size={18} />
                  </button>
                </div>
                
                {partner.status === 'Active' ? (
                  <div className="flex gap-2">
                    <button className="text-[11px] font-medium text-white/40 hover:text-white transition-colors px-2 py-1 rounded bg-white/5">Roll API Key</button>
                    <button className="text-[11px] font-medium text-red-400 hover:text-red-300 transition-colors px-2 py-1 rounded bg-red-500/10">Revoke Access</button>
                  </div>
                ) : (
                  <button className="text-[11px] font-medium text-[#3DA9E0] hover:text-white transition-colors px-2 py-1 rounded bg-[#3DA9E0]/10">Generate Credentials</button>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
