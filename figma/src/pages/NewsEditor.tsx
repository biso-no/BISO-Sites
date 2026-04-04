import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { motion } from "motion/react";
import { ChevronLeft, Check, Type, ImageIcon, Eye, PenTool } from "lucide-react";

export function NewsEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === 'new';
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    title: isNew ? '' : 'BISO launches new AI-driven campus platform',
    author: 'Alex Editor',
    category: 'Technology',
    image: 'https://images.unsplash.com/photo-1762793194390-4eaf3673f045?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxuZXdzcGFwZXIlMjBhcnRpY2xlJTIwbW9kZXJuJTIwZGFya3xlbnwxfHx8fDE3NzUyOTMwODB8MA&ixlib=rb-4.1.0&q=80&w=1080',
    status: 'draft',
    content: ''
  });

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      navigate("/news");
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
            onClick={() => navigate('/news')}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 transition-all"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-light tracking-tight text-white">
                {isNew ? 'Write Article' : 'Edit Article'}
              </h1>
              <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/40 text-[10px] uppercase tracking-widest font-mono">
                {formData.status}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Link to="/news" className="text-white/40 text-xs hover:text-[#3DA9E0] transition-colors">News</Link>
              <span className="text-white/20 text-xs">/</span>
              <span className="text-white/40 text-xs truncate max-w-[200px]">{formData.title || 'Untitled'}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/news')}
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
                <Check size={16} /> Publish Article
              </>
            )}
          </button>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row gap-12 lg:gap-16 items-start">
        {/* Left: Editorial Form */}
        <div className="flex-1 w-full space-y-12">
          <section>
            <textarea 
              value={formData.title}
              onChange={e => setFormData({...formData, title: e.target.value})}
              placeholder="Headline..."
              rows={2}
              className="w-full bg-transparent text-4xl md:text-6xl font-serif text-white placeholder:text-white/20 border-none outline-none pb-4 focus:border-b focus:border-[#3DA9E0]/50 transition-all border-b border-transparent resize-none"
            />
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-[11px] uppercase tracking-widest font-semibold text-[#3DA9E0] flex items-center gap-2">
                <PenTool size={12} /> Author
              </label>
              <input 
                type="text" 
                value={formData.author}
                onChange={e => setFormData({...formData, author: e.target.value})}
                className="w-full bg-transparent border-b border-white/10 pb-2 text-lg text-white outline-none focus:border-[#3DA9E0] transition-colors"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] uppercase tracking-widest font-semibold text-[#3DA9E0]">Category</label>
              <select 
                value={formData.category}
                onChange={e => setFormData({...formData, category: e.target.value})}
                className="w-full bg-transparent border-b border-white/10 pb-2 text-lg text-white outline-none focus:border-[#3DA9E0] transition-colors appearance-none"
              >
                <option value="Technology" className="bg-[#000a16]">Technology</option>
                <option value="Campus Politics" className="bg-[#000a16]">Campus Politics</option>
                <option value="Student Life" className="bg-[#000a16]">Student Life</option>
              </select>
            </div>
          </section>

          <section className="space-y-4 pt-4">
            <div className="space-y-2">
              <label className="text-[11px] uppercase tracking-widest font-semibold text-white/50 flex items-center gap-2">
                <ImageIcon size={12} /> Featured Image URL
              </label>
              <input 
                type="url" 
                value={formData.image}
                onChange={e => setFormData({...formData, image: e.target.value})}
                placeholder="https://..."
                className="w-full bg-transparent border-b border-white/10 pb-2 text-white outline-none focus:border-[#3DA9E0] transition-colors"
              />
            </div>
          </section>

          <section className="space-y-4">
            <label className="text-[11px] uppercase tracking-widest font-semibold text-[#3DA9E0] flex items-center gap-2">
              <Type size={12} /> Body Content
            </label>
            <div className="border border-white/10 rounded-2xl p-2 bg-white/[0.01] focus-within:border-[#3DA9E0]/50 transition-colors">
              <textarea 
                rows={20}
                value={formData.content}
                onChange={e => setFormData({...formData, content: e.target.value})}
                placeholder="Write your article in markdown..."
                className="w-full bg-transparent p-4 text-white/90 outline-none resize-none custom-scrollbar font-mono text-sm leading-relaxed"
              />
            </div>
          </section>
        </div>

        {/* Right: Sticky Cinematic Preview */}
        <div className="w-full lg:w-[450px] shrink-0 sticky top-32">
          <div className="flex items-center gap-2 mb-4 px-2">
            <Eye size={14} className="text-[#3DA9E0]" />
            <span className="text-xs font-mono text-white/50 uppercase tracking-widest">Editorial Preview</span>
          </div>

          <div className="rounded-3xl border border-white/10 overflow-hidden bg-[#000a16] shadow-2xl group">
            <div className="h-64 relative overflow-hidden bg-[#001731]">
              {formData.image ? (
                <img src={formData.image} className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-700" alt="Article" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <ImageIcon size={32} className="text-white/20" />
                </div>
              )}
            </div>
            
            <div className="p-8 -mt-12 relative z-10">
              <div className="bg-[#00050d]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl">
                <span className="text-[10px] font-bold tracking-widest text-[#3DA9E0] uppercase block mb-3">
                  {formData.category || 'Category'}
                </span>
                <h3 className="text-2xl font-serif text-white leading-snug mb-4">
                  {formData.title || 'Untitled Article'}
                </h3>
                <div className="flex items-center gap-3 text-xs text-white/50">
                  <span className="font-medium text-white/80">{formData.author || 'Author'}</span>
                  <span className="w-1 h-1 rounded-full bg-white/20" />
                  <span>Just now</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
