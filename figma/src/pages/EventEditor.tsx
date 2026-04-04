import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { motion } from "motion/react";
import { ChevronLeft, Check, Calendar, MapPin, ImageIcon, Link2, Eye, CalendarDays } from "lucide-react";

export function EventEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === 'new';
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    title: isNew ? '' : 'Fadderullan Main Party',
    date: '2026-08-15T21:00',
    location: 'Oslo Spektrum',
    image: 'https://images.unsplash.com/photo-1772251784323-5e317816a8de?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxldmVudCUyMGNvbmNlcnQlMjBjcm93ZCUyMGRhcmt8ZW58MXx8fHwxNzc1MjkyNTI4fDA&ixlib=rb-4.1.0&q=80&w=1080',
    price: '250',
    status: 'draft'
  });

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      navigate("/events");
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
            onClick={() => navigate('/events')}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 transition-all"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-light tracking-tight text-white">
                {isNew ? 'Create Event' : 'Edit Event'}
              </h1>
              <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/40 text-[10px] uppercase tracking-widest font-mono">
                {formData.status}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Link to="/events" className="text-white/40 text-xs hover:text-[#3DA9E0] transition-colors">Events</Link>
              <span className="text-white/20 text-xs">/</span>
              <span className="text-white/40 text-xs truncate max-w-[200px]">{formData.title || 'Untitled'}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/events')}
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
              placeholder="Enter event title..."
              className="w-full bg-transparent text-4xl md:text-5xl font-light tracking-tight text-white placeholder:text-white/20 border-none outline-none pb-4 focus:border-b focus:border-[#3DA9E0]/50 transition-all border-b border-transparent"
            />
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-[11px] uppercase tracking-widest font-semibold text-[#3DA9E0] flex items-center gap-2">
                <CalendarDays size={12} /> Start Date & Time
              </label>
              <input 
                type="datetime-local" 
                value={formData.date}
                onChange={e => setFormData({...formData, date: e.target.value})}
                className="w-full bg-transparent border-b border-white/10 pb-2 text-lg text-white outline-none focus:border-[#3DA9E0] transition-colors [color-scheme:dark]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] uppercase tracking-widest font-semibold text-[#3DA9E0] flex items-center gap-2">
                <MapPin size={12} /> Location
              </label>
              <input 
                type="text" 
                value={formData.location}
                onChange={e => setFormData({...formData, location: e.target.value})}
                placeholder="e.g. Campus Kroa"
                className="w-full bg-transparent border-b border-white/10 pb-2 text-lg text-white outline-none focus:border-[#3DA9E0] transition-colors"
              />
            </div>
          </section>

          <section className="space-y-8 border-l border-white/10 pl-8 relative">
            <div className="absolute top-0 -left-[1.5px] w-[3px] h-8 bg-[#3DA9E0] rounded-r-full" />
            <div className="space-y-4">
              <label className="text-[11px] uppercase tracking-widest font-semibold text-white/50">Event Details</label>
              <textarea 
                rows={6}
                placeholder="Write a captivating description of what to expect..."
                className="w-full bg-white/[0.02] border border-white/[0.05] rounded-2xl p-6 text-white/90 outline-none focus:border-[#3DA9E0]/50 transition-colors resize-none custom-scrollbar leading-relaxed"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
              <div className="space-y-2">
                <label className="text-[11px] uppercase tracking-widest font-semibold text-white/50 flex items-center gap-2">
                  <ImageIcon size={12} /> Cover Image URL
                </label>
                <input 
                  type="url" 
                  value={formData.image}
                  onChange={e => setFormData({...formData, image: e.target.value})}
                  placeholder="https://..."
                  className="w-full bg-transparent border-b border-white/10 pb-2 text-white outline-none focus:border-[#3DA9E0] transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] uppercase tracking-widest font-semibold text-white/50">Ticket Price (NOK)</label>
                <input 
                  type="number" 
                  value={formData.price}
                  onChange={e => setFormData({...formData, price: e.target.value})}
                  placeholder="0 for free"
                  className="w-full bg-transparent border-b border-white/10 pb-2 text-white outline-none focus:border-[#3DA9E0] transition-colors"
                />
              </div>
            </div>
          </section>
        </div>

        {/* Right: Sticky Cinematic Preview */}
        <div className="w-full lg:w-[400px] shrink-0 sticky top-32">
          <div className="flex items-center gap-2 mb-4 px-2">
            <Eye size={14} className="text-[#3DA9E0]" />
            <span className="text-xs font-mono text-white/50 uppercase tracking-widest">App Preview</span>
          </div>

          <div className="rounded-3xl border border-white/10 overflow-hidden relative group aspect-[4/5] bg-[#001731] shadow-2xl">
            {formData.image ? (
              <img src={formData.image} className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-700" alt="Event Cover" />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-[#001731] to-[#000a16]" />
            )}
            
            <div className="absolute inset-0 bg-gradient-to-t from-[#00050d] via-[#00050d]/60 to-transparent" />
            
            <div className="absolute inset-0 p-8 flex flex-col justify-end">
              <div className="mb-auto self-end">
                <span className="backdrop-blur-md bg-black/40 text-white border border-white/10 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase">
                  {formData.price && Number(formData.price) > 0 ? `NOK ${formData.price}` : 'Free Entry'}
                </span>
              </div>

              <div>
                <div className="flex items-center gap-3 text-white/80 text-sm mb-3 font-medium">
                  <span className="flex items-center gap-1.5 bg-[#3DA9E0]/20 text-[#3DA9E0] px-2 py-1 rounded-md text-xs">
                    <Calendar size={14} /> Aug 15
                  </span>
                  <span className="flex items-center gap-1.5">
                    <MapPin size={14} /> {formData.location || 'TBA'}
                  </span>
                </div>
                <h3 className="text-3xl font-semibold text-white leading-tight mb-6">
                  {formData.title || 'Untitled Event'}
                </h3>
                <button className="w-full py-4 rounded-xl bg-[#3DA9E0] text-[#001731] font-bold text-sm shadow-[0_0_20px_rgba(61,169,224,0.4)] hover:shadow-[0_0_30px_rgba(61,169,224,0.6)] transition-all">
                  Get Tickets
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
