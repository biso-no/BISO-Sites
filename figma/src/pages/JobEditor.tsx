import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { motion } from "motion/react";
import { ChevronLeft, Check, MapPin, Building2, LayoutList, Eye, ArrowUpRight } from "lucide-react";

export function JobEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === 'new';
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    title: isNew ? '' : 'Senior Frontend Developer',
    company: 'TechCorp Oslo',
    type: 'Full-time',
    location: 'oslo',
    status: 'draft'
  });

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      navigate("/jobs");
    }, 1000);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="max-w-[1400px] mx-auto pb-12"
    >
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-8 border-b border-white/10 mb-8 sticky top-0 bg-[#000a16]/90 backdrop-blur-xl z-20 pt-4 -mt-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/jobs')}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 transition-all"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-light tracking-tight text-white">
                {isNew ? 'New Job Post' : 'Edit Job Post'}
              </h1>
              <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/40 text-[10px] uppercase tracking-widest font-mono">
                {formData.status}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Link to="/jobs" className="text-white/40 text-xs hover:text-[#3DA9E0] transition-colors">Jobs</Link>
              <span className="text-white/20 text-xs">/</span>
              <span className="text-white/40 text-xs truncate max-w-[200px]">{formData.title || 'Untitled'}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/jobs')}
            className="px-5 py-2.5 rounded-full border border-white/10 text-white/70 text-sm font-medium hover:bg-white/5 transition-all"
          >
            Discard
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2.5 rounded-full bg-[#3DA9E0] text-[#001731] text-sm font-bold shadow-[0_0_20px_rgba(61,169,224,0.3)] hover:shadow-[0_0_30px_rgba(61,169,224,0.5)] transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {isSaving ? 'Publishing...' : (
              <>
                <Check size={16} /> Publish Live
              </>
            )}
          </button>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row gap-12 lg:gap-16 items-start">
        {/* Left: Editorial Form */}
        <div className="flex-1 w-full space-y-16">
          <section>
            <input 
              type="text" 
              value={formData.title}
              onChange={e => setFormData({...formData, title: e.target.value})}
              placeholder="Enter job title..."
              className="w-full bg-transparent text-4xl md:text-5xl font-light tracking-tight text-white placeholder:text-white/20 border-none outline-none pb-4 focus:border-b focus:border-[#3DA9E0]/50 transition-all border-b border-transparent"
            />
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-[11px] uppercase tracking-widest font-semibold text-[#3DA9E0]">Company Name</label>
              <input 
                type="text" 
                value={formData.company}
                onChange={e => setFormData({...formData, company: e.target.value})}
                placeholder="e.g. TechCorp Oslo"
                className="w-full bg-transparent border-b border-white/10 pb-2 text-lg text-white outline-none focus:border-[#3DA9E0] transition-colors"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] uppercase tracking-widest font-semibold text-[#3DA9E0]">Employment Type</label>
              <select 
                value={formData.type}
                onChange={e => setFormData({...formData, type: e.target.value})}
                className="w-full bg-transparent border-b border-white/10 pb-2 text-lg text-white outline-none focus:border-[#3DA9E0] transition-colors appearance-none"
              >
                <option value="Full-time" className="bg-[#000a16]">Full-time</option>
                <option value="Part-time" className="bg-[#000a16]">Part-time</option>
                <option value="Internship" className="bg-[#000a16]">Internship</option>
                <option value="Graduate" className="bg-[#000a16]">Graduate</option>
              </select>
            </div>
          </section>

          <section className="space-y-8 border-l border-white/10 pl-8 relative">
            <div className="absolute top-0 -left-[1.5px] w-[3px] h-8 bg-[#3DA9E0] rounded-r-full" />
            <div className="space-y-4">
              <label className="text-[11px] uppercase tracking-widest font-semibold text-white/50">The Role (EN)</label>
              <textarea 
                rows={6}
                placeholder="Write a compelling job description..."
                className="w-full bg-white/[0.02] border border-white/[0.05] rounded-2xl p-6 text-white/90 outline-none focus:border-[#3DA9E0]/50 transition-colors resize-none custom-scrollbar leading-relaxed"
              />
            </div>
            <div className="space-y-4">
              <label className="text-[11px] uppercase tracking-widest font-semibold text-white/50">The Role (NO)</label>
              <textarea 
                rows={6}
                placeholder="Skriv en overbevisende stillingsbeskrivelse..."
                className="w-full bg-white/[0.02] border border-white/[0.05] rounded-2xl p-6 text-white/90 outline-none focus:border-[#3DA9E0]/50 transition-colors resize-none custom-scrollbar leading-relaxed"
              />
            </div>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 border-t border-white/10">
            <div className="space-y-2">
              <label className="text-[11px] uppercase tracking-widest font-semibold text-white/50 flex items-center gap-2">
                <MapPin size={12} /> Target Campus
              </label>
              <select 
                value={formData.location}
                onChange={e => setFormData({...formData, location: e.target.value})}
                className="w-full bg-transparent border-b border-white/10 pb-2 text-white outline-none focus:border-[#3DA9E0] transition-colors appearance-none"
              >
                <option value="oslo" className="bg-[#000a16]">BI Oslo</option>
                <option value="bergen" className="bg-[#000a16]">BI Bergen</option>
                <option value="trondheim" className="bg-[#000a16]">BI Trondheim</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[11px] uppercase tracking-widest font-semibold text-white/50 flex items-center gap-2">
                <LayoutList size={12} /> URL Slug
              </label>
              <div className="flex border-b border-white/10 pb-2 focus-within:border-[#3DA9E0] transition-colors">
                <span className="text-white/30 text-sm mt-0.5 mr-1">/jobs/</span>
                <input 
                  type="text" 
                  placeholder="role-title"
                  className="flex-1 bg-transparent text-white outline-none"
                />
              </div>
            </div>
          </section>
        </div>

        {/* Right: Sticky Cinematic Preview */}
        <div className="w-full lg:w-[420px] shrink-0 sticky top-32">
          <div className="flex items-center gap-2 mb-4 px-2">
            <Eye size={14} className="text-[#3DA9E0]" />
            <span className="text-xs font-mono text-white/50 uppercase tracking-widest">Live Preview</span>
          </div>

          <div className="rounded-3xl bg-gradient-to-br from-white/[0.05] to-transparent border border-white/[0.05] p-8 backdrop-blur-xl relative overflow-hidden group">
            {/* Ambient background blur */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#3DA9E0]/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
            
            <div className="relative z-10 space-y-6">
              <div className="w-16 h-16 rounded-2xl bg-[#001731] border border-white/10 flex items-center justify-center overflow-hidden">
                <Building2 size={24} className="text-[#3DA9E0]/50" />
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="px-2.5 py-1 rounded-full bg-white/10 text-white/80 text-[10px] uppercase tracking-wider font-semibold border border-white/5">
                    {formData.type}
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-[#3DA9E0]/10 text-[#3DA9E0] text-[10px] uppercase tracking-wider font-semibold border border-[#3DA9E0]/20">
                    {formData.location.toUpperCase()}
                  </span>
                </div>
                <h3 className="text-2xl font-light text-white leading-tight mb-2">
                  {formData.title || 'Untitled Role'}
                </h3>
                <p className="text-white/50 text-sm">{formData.company}</p>
              </div>

              <div className="pt-6 border-t border-white/10">
                <div className="w-full py-3 rounded-xl bg-white text-black font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer hover:bg-gray-200 transition-colors">
                  Apply Now <ArrowUpRight size={16} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
