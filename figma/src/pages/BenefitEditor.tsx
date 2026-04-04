import { useState } from "react";
import { motion } from "motion/react";
import { Link } from "react-router";
import { 
  ChevronLeft, Save, Globe, MapPin, 
  Image as ImageIcon, Percent, Ticket, Coffee, Gift, QrCode
} from "lucide-react";

export function BenefitEditor() {
  const [scope, setScope] = useState<'National' | 'Campus'>('National');
  const [type, setType] = useState('Discount');

  return (
    <div className="flex flex-col lg:flex-row gap-8 pb-12 min-h-[calc(100vh-8rem)]">
      {/* Left Pane: Editor Form */}
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full lg:w-[55%] flex flex-col"
      >
        <header className="flex items-center justify-between mb-8 sticky top-0 bg-[#000a16]/90 backdrop-blur-xl z-20 py-4 border-b border-white/10">
          <div className="flex items-center gap-4">
            <Link 
              to="/benefits"
              className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            >
              <ChevronLeft size={20} />
            </Link>
            <div>
              <h1 className="text-2xl font-light text-white">Edit Benefit</h1>
              <p className="text-white/40 text-sm font-mono mt-0.5">ID: ben_194x8f</p>
            </div>
          </div>
          <button className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#3DA9E0] text-[#001731] font-semibold shadow-[0_0_20px_rgba(61,169,224,0.3)] hover:shadow-[0_0_30px_rgba(61,169,224,0.5)] transition-all">
            <Save size={18} />
            Publish
          </button>
        </header>

        <div className="space-y-8 flex-1 pr-2">
          {/* Scope Selection */}
          <section className="bg-white/[0.02] border border-white/[0.05] rounded-3xl p-6 backdrop-blur-sm">
            <h2 className="text-sm font-bold tracking-widest uppercase text-white/40 mb-6">Target Audience</h2>
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => setScope('National')}
                className={`p-4 rounded-xl border text-left transition-all ${
                  scope === 'National' 
                    ? 'bg-[#3DA9E0]/10 border-[#3DA9E0]/30 shadow-[0_0_15px_rgba(61,169,224,0.1)]' 
                    : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Globe size={24} className={`mb-3 ${scope === 'National' ? 'text-[#3DA9E0]' : ''}`} />
                <h3 className={`font-medium ${scope === 'National' ? 'text-[#3DA9E0]' : ''}`}>National</h3>
                <p className="text-xs opacity-70 mt-1">Available to all BISO members globally.</p>
              </button>
              
              <button 
                onClick={() => setScope('Campus')}
                className={`p-4 rounded-xl border text-left transition-all ${
                  scope === 'Campus' 
                    ? 'bg-emerald-400/10 border-emerald-400/30 shadow-[0_0_15px_rgba(52,211,153,0.1)]' 
                    : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white'
                }`}
              >
                <MapPin size={24} className={`mb-3 ${scope === 'Campus' ? 'text-emerald-400' : ''}`} />
                <h3 className={`font-medium ${scope === 'Campus' ? 'text-emerald-400' : ''}`}>Campus Specific</h3>
                <p className="text-xs opacity-70 mt-1">Restricted to members of a single campus.</p>
              </button>
            </div>

            {scope === 'Campus' && (
              <div className="mt-4 pt-4 border-t border-white/10">
                <label className="text-sm font-medium text-white/70 mb-2 block">Select Campus</label>
                <select className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-[#3DA9E0] transition-colors appearance-none">
                  <option>Oslo</option>
                  <option>Bergen</option>
                  <option>Stavanger</option>
                  <option>Trondheim</option>
                </select>
              </div>
            )}
          </section>

          {/* Basic Details */}
          <section className="bg-white/[0.02] border border-white/[0.05] rounded-3xl p-6 backdrop-blur-sm space-y-5">
            <h2 className="text-sm font-bold tracking-widest uppercase text-white/40 mb-4">Benefit Details</h2>
            
            <div className="grid grid-cols-2 gap-5">
              <div className="col-span-2">
                <label className="text-sm font-medium text-white/70 mb-2 block">Benefit Title</label>
                <input 
                  type="text" 
                  defaultValue="20% Off All Beverages"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-[#3DA9E0] transition-colors" 
                />
              </div>
              
              <div>
                <label className="text-sm font-medium text-white/70 mb-2 block">Provider / Partner Name</label>
                <input 
                  type="text" 
                  defaultValue="Espresso House"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-[#3DA9E0] transition-colors" 
                />
              </div>

              <div>
                <label className="text-sm font-medium text-white/70 mb-2 block">Type</label>
                <div className="relative">
                  <select 
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white outline-none focus:border-[#3DA9E0] transition-colors appearance-none"
                  >
                    <option>Discount</option>
                    <option>Service</option>
                    <option>Access</option>
                    <option>Other</option>
                  </select>
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/50">
                    {type === 'Discount' && <Percent size={16} />}
                    {type === 'Service' && <Coffee size={16} />}
                    {type === 'Access' && <Ticket size={16} />}
                    {type === 'Other' && <Gift size={16} />}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-white/70 mb-2 block">Description</label>
              <textarea 
                rows={3}
                defaultValue="Get a 20% discount on all hot and cold beverages at any Espresso House location in Norway. Just show your active BISO membership in the app at the counter."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-[#3DA9E0] transition-colors resize-none" 
              />
            </div>
          </section>

          {/* Redemption Details */}
          <section className="bg-white/[0.02] border border-white/[0.05] rounded-3xl p-6 backdrop-blur-sm space-y-5">
            <h2 className="text-sm font-bold tracking-widest uppercase text-white/40 mb-4">Redemption</h2>
            
            <div>
              <label className="text-sm font-medium text-white/70 mb-2 block">How do students claim this?</label>
              <select className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-[#3DA9E0] transition-colors appearance-none">
                <option>Show Active Membership Screen</option>
                <option>Promo Code</option>
                <option>External Link</option>
                <option>QR Code Scan</option>
              </select>
            </div>
            
            <div>
              <label className="text-sm font-medium text-white/70 mb-2 block">Redemption Instructions (Optional)</label>
              <input 
                type="text" 
                placeholder="e.g., Show this screen to the barista before paying."
                defaultValue="Show this screen to the barista before paying."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-[#3DA9E0] transition-colors" 
              />
            </div>
          </section>

          {/* Image */}
          <section className="bg-white/[0.02] border border-white/[0.05] rounded-3xl p-6 backdrop-blur-sm">
            <h2 className="text-sm font-bold tracking-widest uppercase text-white/40 mb-4">Cover Image</h2>
            <div className="w-full h-48 rounded-2xl border-2 border-dashed border-white/20 bg-white/5 flex flex-col items-center justify-center text-white/50 hover:text-white hover:border-[#3DA9E0] hover:bg-white/10 transition-all cursor-pointer relative overflow-hidden group">
              <img 
                src="https://images.unsplash.com/photo-1554118811-1e0d58224f24?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb2ZmZWUlMjBzaG9wfGVufDF8fHx8MTc3NTI5NjAwMHww&ixlib=rb-4.1.0&q=80&w=1080" 
                alt="Cover" 
                className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-30 transition-opacity" 
              />
              <div className="relative z-10 flex flex-col items-center gap-2">
                <ImageIcon size={24} />
                <span className="text-sm font-medium">Replace Image</span>
              </div>
            </div>
          </section>
        </div>
      </motion.div>

      {/* Right Pane: Live Preview */}
      <motion.div 
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="w-full lg:w-[45%] lg:sticky lg:top-8 h-fit flex flex-col items-center justify-center pt-8 lg:pt-16"
      >
        <div className="text-center mb-8">
          <h3 className="text-white/50 font-mono text-sm uppercase tracking-widest mb-2">Live App Preview</h3>
          <p className="text-white/30 text-xs">This is how the benefit appears in the student app</p>
        </div>

        {/* Mobile Device Mockup */}
        <div className="w-[320px] h-[650px] bg-black rounded-[40px] border-[8px] border-[#001731] shadow-2xl relative overflow-hidden flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.5)]">
          {/* Dynamic Island fake */}
          <div className="absolute top-0 inset-x-0 h-6 flex justify-center z-50">
            <div className="w-24 h-5 bg-[#001731] rounded-b-xl" />
          </div>

          <div className="flex-1 bg-[#000a16] overflow-y-auto hide-scrollbar pb-10">
            {/* Header Image */}
            <div className="h-64 relative bg-[#001731]">
              <img 
                src="https://images.unsplash.com/photo-1554118811-1e0d58224f24?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb2ZmZWUlMjBzaG9wfGVufDF8fHx8MTc3NTI5NjAwMHww&ixlib=rb-4.1.0&q=80&w=1080" 
                alt="Preview" 
                className="w-full h-full object-cover opacity-80"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#000a16] via-[#000a16]/20 to-transparent" />
              
              <div className="absolute top-10 left-4">
                <div className="w-8 h-8 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center border border-white/10 text-white">
                  <ChevronLeft size={16} />
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="px-5 -mt-8 relative z-10">
              <div className="flex gap-2 mb-3">
                <span className={`px-2.5 py-1 rounded-full text-[9px] uppercase tracking-wider font-bold backdrop-blur-md border flex items-center gap-1 bg-[#000a16]/80 ${
                  scope === 'National' ? 'text-[#3DA9E0] border-[#3DA9E0]/30' : 'text-emerald-400 border-emerald-400/30'
                }`}>
                  {scope === 'National' ? <Globe size={10} /> : <MapPin size={10} />}
                  {scope}
                </span>
                <span className="px-2.5 py-1 rounded-full text-[9px] uppercase tracking-wider font-bold backdrop-blur-md border border-white/10 text-white/70 bg-[#000a16]/80 flex items-center gap-1">
                  {type === 'Discount' && <Percent size={10} />}
                  {type === 'Service' && <Coffee size={10} />}
                  {type === 'Access' && <Ticket size={10} />}
                  {type === 'Other' && <Gift size={10} />}
                  {type}
                </span>
              </div>

              <h1 className="text-2xl font-medium text-white leading-tight mb-1">20% Off All Beverages</h1>
              <p className="text-[#3DA9E0] font-medium text-sm mb-6">Espresso House</p>

              <p className="text-white/70 text-sm leading-relaxed mb-8">
                Get a 20% discount on all hot and cold beverages at any Espresso House location in Norway. Just show your active BISO membership in the app at the counter.
              </p>

              {/* Redemption Card */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-[#3DA9E0]/10 to-transparent opacity-50" />
                <div className="relative z-10">
                  <QrCode size={48} className="mx-auto text-white/30 mb-3" />
                  <p className="text-white font-medium text-sm">Active Membership Required</p>
                  <p className="text-white/50 text-xs mt-1 mb-4">Show this screen to the barista before paying.</p>
                  <div className="py-3 bg-[#3DA9E0] text-[#001731] font-bold rounded-xl shadow-[0_0_15px_rgba(61,169,224,0.3)]">
                    Redeem Benefit
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
