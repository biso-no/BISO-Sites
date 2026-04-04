import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { 
  ChevronLeft, Monitor, Smartphone, Globe, Settings, 
  History, Layout, Check, Type, Image as ImageIcon, 
  Columns, PlayCircle, Layers, Maximize2, X, Plus
} from "lucide-react";
import { MOCK_PAGES } from "../data";

export function PageEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'build' | 'settings' | 'history'>('build');
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [isSaving, setIsSaving] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  
  const page = MOCK_PAGES.find(p => p.id === id) || { title: 'Untitled Page', status: 'draft' };

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => setIsSaving(false), 1500);
  };

  return (
    <div className="h-screen w-full bg-[#00050d] text-white overflow-hidden flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <header className="h-16 border-b border-white/10 bg-[#000a16]/80 backdrop-blur-xl flex items-center justify-between px-4 z-50 shrink-0">
        <div className="flex items-center gap-4 flex-1">
          <button 
            onClick={() => navigate('/pages')}
            className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          
          <div className="h-6 w-px bg-white/10" />
          
          <div className="flex flex-col">
            <input 
              type="text" 
              defaultValue={page.title}
              className="bg-transparent text-sm font-medium text-white outline-none w-64 focus:border-b focus:border-[#3DA9E0]/50"
            />
            <span className="text-[10px] text-white/40 uppercase tracking-widest font-mono mt-0.5 flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${page.status === 'published' ? 'bg-[#3DA9E0]' : 'bg-white/40'}`} />
              {page.status}
            </span>
          </div>
        </div>

        {/* Center Controls (Viewport + Tabs) */}
        <div className="flex items-center gap-6 justify-center flex-1">
          <div className="flex bg-white/5 rounded-lg p-1 border border-white/10">
            <button 
              onClick={() => setDevice('desktop')}
              className={`p-1.5 rounded-md transition-all ${device === 'desktop' ? 'bg-white/10 text-white shadow-sm' : 'text-white/40 hover:text-white/80'}`}
            >
              <Monitor size={16} />
            </button>
            <button 
              onClick={() => setDevice('mobile')}
              className={`p-1.5 rounded-md transition-all ${device === 'mobile' ? 'bg-white/10 text-white shadow-sm' : 'text-white/40 hover:text-white/80'}`}
            >
              <Smartphone size={16} />
            </button>
          </div>
          
          <div className="h-6 w-px bg-white/10" />
          
          <div className="flex gap-1">
            {[
              { id: 'build', icon: Layout, label: 'Build' },
              { id: 'settings', icon: Settings, label: 'Settings' },
              { id: 'history', icon: History, label: 'History' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.id ? 'bg-[#3DA9E0]/10 text-[#3DA9E0]' : 'text-white/50 hover:text-white hover:bg-white/5'
                }`}
              >
                <tab.icon size={14} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center justify-end gap-3 flex-1">
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 text-white/70 text-sm hover:bg-white/5 transition-all">
            <Globe size={14} />
            <span className="font-medium">EN</span>
          </button>
          
          <span className="text-white/30 text-xs mr-2">
            {isSaving ? 'Saving...' : 'Saved 2m ago'}
          </span>
          
          <button 
            onClick={handleSave}
            className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm font-medium hover:bg-white/10 transition-all flex items-center gap-2"
          >
            {isSaving ? <Check size={14} className="text-[#3DA9E0]" /> : null}
            Save Draft
          </button>
          <button 
            onClick={() => setShowPublishModal(true)}
            className="px-5 py-2 rounded-lg bg-[#3DA9E0] text-[#001731] text-sm font-semibold shadow-[0_0_15px_rgba(61,169,224,0.3)] hover:shadow-[0_0_25px_rgba(61,169,224,0.5)] transition-all"
          >
            Publish
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* Left Panel: Blocks Palette (Only visible in Build mode) */}
        <AnimatePresence>
          {activeTab === 'build' && (
            <motion.div 
              initial={{ x: -300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -300, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-72 border-r border-white/10 bg-[#000a16]/95 backdrop-blur-md overflow-y-auto shrink-0 custom-scrollbar z-10"
            >
              <div className="p-4">
                <h3 className="text-xs font-mono uppercase tracking-widest text-white/40 mb-4">Add Elements</h3>
                
                <div className="space-y-6">
                  <BlockCategory title="Layout" items={[
                    { icon: Layers, name: 'Hero Section', desc: 'Full bleed image & text' },
                    { icon: Columns, name: 'Split Content', desc: 'Text & media side-by-side' },
                    { icon: Layout, name: 'Grid', desc: 'Masonry or standard grid' }
                  ]} />
                  
                  <BlockCategory title="Basic" items={[
                    { icon: Type, name: 'Rich Text', desc: 'Formatted typography' },
                    { icon: ImageIcon, name: 'Image/Video', desc: 'Single media element' },
                  ]} />
                  
                  <BlockCategory title="Dynamic" items={[
                    { icon: PlayCircle, name: 'Events Carousel', desc: 'Upcoming BISO events' },
                    { icon: Maximize2, name: 'Job Board Mini', desc: 'Latest job postings' },
                  ]} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Center: Canvas Canvas Canvas! */}
        <div className="flex-1 bg-black/40 relative overflow-hidden flex items-center justify-center p-8">
          {/* Ambient Glow behind canvas */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#3DA9E0]/5 rounded-full blur-[100px] pointer-events-none" />
          
          <motion.div 
            layout
            className={`
              relative bg-white shadow-2xl rounded-xl overflow-hidden ring-1 ring-white/10 transition-all duration-500 origin-top
              ${device === 'mobile' ? 'w-[375px] h-[812px]' : 'w-full max-w-[1200px] h-full'}
            `}
          >
            {/* The actual preview rendering would go here. We mock a beautiful high-end page preview. */}
            <div className="w-full h-full overflow-y-auto custom-scrollbar bg-[#040914] text-white">
              
              {/* Mock Hero Block */}
              <div className="relative h-[60vh] min-h-[400px] w-full group">
                <img 
                  src={page.image || MOCK_PAGES[0].image} 
                  alt="Hero" 
                  className="w-full h-full object-cover opacity-60"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#040914] via-[#040914]/40 to-transparent" />
                <div className="absolute inset-0 flex flex-col justify-end p-12">
                  <div className="border border-[#3DA9E0]/50 border-dashed rounded-lg p-4 -m-4 hover:bg-[#3DA9E0]/5 transition-colors cursor-pointer relative group/edit">
                    <div className="absolute -top-3 -right-3 bg-[#3DA9E0] text-black text-[10px] font-bold px-2 py-1 rounded shadow-lg opacity-0 group-hover/edit:opacity-100 transition-opacity">Edit Hero</div>
                    <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-4">{page.title}</h1>
                    <p className="text-xl text-white/60 max-w-2xl">A premium digital experience built for students, by students.</p>
                  </div>
                </div>
              </div>

              {/* Mock Content Block */}
              <div className="p-12 max-w-4xl mx-auto space-y-8">
                <div className="border border-white/20 border-dashed rounded-lg p-6 hover:bg-white/5 transition-colors cursor-pointer relative group/edit">
                   <div className="absolute -top-3 -right-3 bg-white text-black text-[10px] font-bold px-2 py-1 rounded shadow-lg opacity-0 group-hover/edit:opacity-100 transition-opacity">Edit Text</div>
                  <h2 className="text-3xl font-light mb-4 text-[#3DA9E0]">The Future of BISO</h2>
                  <p className="text-white/70 leading-relaxed text-lg">
                    This immersive content block is ready to be edited. Click here to open the rich text editor on the right panel. The cinematic design language pushes boundaries while retaining deep usability.
                  </p>
                </div>
              </div>

              {/* Add Block Placeholder */}
              <div className="mx-12 mb-24 h-32 border-2 border-dashed border-white/10 rounded-2xl flex items-center justify-center text-white/30 hover:bg-white/5 hover:border-[#3DA9E0]/50 hover:text-[#3DA9E0] transition-all cursor-pointer">
                <div className="flex flex-col items-center gap-2">
                  <Plus size={24} />
                  <span className="text-sm font-medium">Drag or Click to Add Block</span>
                </div>
              </div>

            </div>
          </motion.div>
        </div>

        {/* Right Panel: Contextual Properties */}
        <AnimatePresence>
          {activeTab !== 'build' && (
            <motion.div 
              initial={{ x: 300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 300, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-80 border-l border-white/10 bg-[#000a16]/95 backdrop-blur-md overflow-y-auto shrink-0 z-10"
            >
              {activeTab === 'settings' && (
                <div className="p-6 space-y-8">
                  <div>
                    <h3 className="text-lg font-medium text-white mb-6">Page Settings</h3>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs text-white/50 mb-1.5 block">URL Slug</label>
                        <div className="flex bg-white/5 rounded-lg border border-white/10 overflow-hidden">
                          <span className="px-3 py-2 text-white/30 text-sm bg-white/5 border-r border-white/10">biso.no</span>
                          <input type="text" defaultValue={page.slug} className="bg-transparent flex-1 px-3 py-2 text-sm text-white outline-none focus:bg-white/5" />
                        </div>
                      </div>

                      <div>
                        <label className="text-xs text-white/50 mb-1.5 block">SEO Meta Title</label>
                        <input type="text" defaultValue={page.title} className="w-full bg-white/5 rounded-lg border border-white/10 px-3 py-2 text-sm text-white outline-none focus:border-[#3DA9E0]/50 transition-colors" />
                      </div>

                      <div>
                        <label className="text-xs text-white/50 mb-1.5 block">SEO Description</label>
                        <textarea rows={3} className="w-full bg-white/5 rounded-lg border border-white/10 px-3 py-2 text-sm text-white outline-none focus:border-[#3DA9E0]/50 transition-colors resize-none" defaultValue="A brief description for search engines." />
                      </div>
                      
                      <div>
                        <label className="text-xs text-white/50 mb-1.5 block">Social Image (OG)</label>
                        <div className="aspect-video rounded-lg border border-white/10 overflow-hidden relative group cursor-pointer">
                          <img src={page.image} className="w-full h-full object-cover opacity-70 group-hover:opacity-40 transition-opacity" />
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-sm font-medium bg-black/60 px-3 py-1.5 rounded-md">Change Image</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="pt-6 border-t border-white/10">
                    <button className="w-full py-2.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors text-sm font-medium">
                      Move to Trash
                    </button>
                  </div>
                </div>
              )}
              
              {activeTab === 'history' && (
                <div className="p-6">
                  <h3 className="text-lg font-medium text-white mb-6">Revision History</h3>
                  <div className="space-y-6 relative before:absolute before:inset-0 before:ml-[11px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-white/10 before:to-transparent">
                    {/* Mock timeline items */}
                    <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                      <div className="flex items-center justify-center w-6 h-6 rounded-full border border-white/10 bg-[#001731] text-[#3DA9E0] shadow-[0_0_10px_#3DA9E0] shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 relative z-10">
                        <div className="w-2 h-2 rounded-full bg-[#3DA9E0]" />
                      </div>
                      <div className="w-[calc(100%-2.5rem)] md:w-[calc(50%-1.5rem)] p-3 rounded-xl border border-[#3DA9E0]/30 bg-[#3DA9E0]/5">
                        <p className="text-sm font-medium text-white">Current Version</p>
                        <p className="text-xs text-white/50 mt-1">Autosaved just now</p>
                      </div>
                    </div>
                    
                    <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                      <div className="flex items-center justify-center w-6 h-6 rounded-full border border-white/10 bg-[#000a16] shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 relative z-10">
                      </div>
                      <div className="w-[calc(100%-2.5rem)] md:w-[calc(50%-1.5rem)] p-3 rounded-xl border border-white/5 hover:border-white/10 hover:bg-white/5 transition-colors cursor-pointer">
                        <p className="text-sm font-medium text-white/80">Published</p>
                        <p className="text-xs text-white/50 mt-1">by Admin • 2h ago</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Publish Modal Overlay */}
      <AnimatePresence>
        {showPublishModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-[#000a16]/80 backdrop-blur-md p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#001731] border border-white/10 rounded-3xl p-8 max-w-md w-full shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#3DA9E0]/20 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2" />
              
              <button 
                onClick={() => setShowPublishModal(false)}
                className="absolute top-6 right-6 text-white/50 hover:text-white"
              >
                <X size={20} />
              </button>

              <h2 className="text-3xl font-light text-white mb-2 relative z-10">Ready to publish?</h2>
              <p className="text-white/60 mb-8 relative z-10">This will make your changes live immediately to all visitors on biso.no.</p>
              
              <div className="space-y-4 mb-8 relative z-10">
                <div className="flex justify-between items-center p-4 bg-white/5 rounded-xl border border-white/5">
                  <span className="text-sm text-white/70">Status</span>
                  <span className="text-sm font-medium text-white">Live Public</span>
                </div>
                <div className="flex justify-between items-center p-4 bg-white/5 rounded-xl border border-white/5">
                  <span className="text-sm text-white/70">Localization</span>
                  <span className="text-sm font-medium text-white">English (Primary)</span>
                </div>
              </div>

              <div className="flex gap-3 relative z-10">
                <button 
                  onClick={() => setShowPublishModal(false)}
                  className="flex-1 py-3 rounded-xl border border-white/10 text-white font-medium hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    setShowPublishModal(false);
                    // Add success toast logic here
                  }}
                  className="flex-1 py-3 rounded-xl bg-[#3DA9E0] text-[#001731] font-bold shadow-[0_0_20px_rgba(61,169,224,0.4)] hover:shadow-[0_0_30px_rgba(61,169,224,0.6)] transition-all"
                >
                  Publish Now
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  );
}

function BlockCategory({ title, items }: { title: string, items: { icon: any, name: string, desc: string }[] }) {
  return (
    <div className="mb-6">
      <h4 className="text-[11px] font-semibold text-white/60 uppercase mb-3 px-2">{title}</h4>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div 
            key={i} 
            draggable
            className="flex items-start gap-3 p-3 rounded-xl hover:bg-white/10 border border-transparent hover:border-white/5 transition-all cursor-grab active:cursor-grabbing group"
          >
            <div className="p-2 rounded-lg bg-white/5 text-white/50 group-hover:text-[#3DA9E0] group-hover:bg-[#3DA9E0]/10 transition-colors">
              <item.icon size={18} />
            </div>
            <div>
              <p className="text-sm font-medium text-white/90 group-hover:text-white transition-colors">{item.name}</p>
              <p className="text-[11px] text-white/40 mt-0.5">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
