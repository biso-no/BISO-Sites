import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Link } from "react-router";
import { 
  ChevronLeft, CheckCircle2, XCircle, Clock, 
  FileText, Briefcase, CalendarDays, Type, Eye, Check
} from "lucide-react";

const DRAFT_ITEMS = [
  {
    id: 'd1',
    title: 'Fadderullan Main Party 2026',
    type: 'event',
    author: 'Event Team',
    submittedAt: '2 hours ago',
    image: 'https://images.unsplash.com/photo-1772251784323-5e317816a8de?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxldmVudCUyMGNvbmNlcnQlMjBjcm93ZCUyMGRhcmt8ZW58MXx8fHwxNzc1MjkyNTI4fDA&ixlib=rb-4.1.0&q=80&w=1080',
    changes: 'Updated ticket URL and start time',
    path: '/events/1'
  },
  {
    id: 'd2',
    title: 'Student Life Overview',
    type: 'page',
    author: 'Sarah Jenkins',
    submittedAt: '5 hours ago',
    image: 'https://images.unsplash.com/photo-1632834380561-d1e05839a33a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx1bml2ZXJzaXR5JTIwY2FtcHVzJTIwc3R1ZGVudHN8ZW58MXx8fHwxNzc1Mjg5MTQ3fDA&ixlib=rb-4.1.0&q=80&w=1080',
    changes: 'New hero image and updated benefits section',
    path: '/editor/2'
  },
  {
    id: 'd3',
    title: 'Marketing Intern (Oslo)',
    type: 'job',
    author: 'Admin',
    submittedAt: '1 day ago',
    image: 'https://images.unsplash.com/photo-1668714341253-81139e265a19?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxvZmZpY2UlMjB3b3Jrc3BhY2UlMjB0ZWNoJTIwZGFya3xlbnwxfHx8fDE3NzUyOTMwODB8MA&ixlib=rb-4.1.0&q=80&w=1080',
    changes: 'Initial creation',
    path: '/jobs/2'
  },
  {
    id: 'd4',
    title: 'BISO launches new AI-driven platform',
    type: 'news',
    author: 'Alex Editor',
    submittedAt: '2 days ago',
    image: 'https://images.unsplash.com/photo-1762793194390-4eaf3673f045?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxuZXdzcGFwZXIlMjBhcnRpY2xlJTIwbW9kZXJuJTIwZGFya3xlbnwxfHx8fDE3NzUyOTMwODB8MA&ixlib=rb-4.1.0&q=80&w=1080',
    changes: 'Drafted press release for main page',
    path: '/news/1'
  }
];

const TYPE_ICONS = {
  page: FileText,
  job: Briefcase,
  event: CalendarDays,
  news: Type
};

export function ReviewDrafts() {
  const [items, setItems] = useState(DRAFT_ITEMS);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleApprove = (id: string) => {
    setProcessingId(id);
    setTimeout(() => {
      setItems(items.filter(item => item.id !== id));
      setProcessingId(null);
    }, 800);
  };

  const handleReject = (id: string) => {
    setItems(items.filter(item => item.id !== id));
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
            to="/"
            className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
          >
            <ChevronLeft size={20} />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl md:text-4xl font-light tracking-tight text-white">
                Review Queue
              </h1>
              <span className="px-3 py-1 rounded-full bg-amber-400/10 text-amber-400 text-xs font-bold font-mono">
                {items.length} Pending
              </span>
            </div>
            <p className="text-white/50 mt-1 text-sm">Review, approve, or reject content submitted by editors.</p>
          </div>
        </div>
      </header>

      {items.length === 0 ? (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center py-32 text-center"
        >
          <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-6">
            <CheckCircle2 size={48} className="text-emerald-400" />
          </div>
          <h2 className="text-2xl font-light text-white mb-2">All caught up!</h2>
          <p className="text-white/50">There are no pending drafts waiting for review.</p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AnimatePresence>
            {items.map((item) => {
              const TypeIcon = TYPE_ICONS[item.type as keyof typeof TYPE_ICONS];
              const isProcessing = processingId === item.id;

              return (
                <motion.div
                  layout
                  key={item.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                  className="rounded-3xl bg-white/[0.02] border border-white/[0.05] overflow-hidden group flex flex-col backdrop-blur-sm"
                >
                  <div className="h-40 relative overflow-hidden bg-[#001731]">
                    <img 
                      src={item.image} 
                      alt={item.title}
                      className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-700"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#000a16] via-[#000a16]/40 to-transparent" />
                    
                    <div className="absolute top-4 left-4 flex gap-2">
                      <span className="px-2.5 py-1 rounded-md bg-white/10 backdrop-blur-md border border-white/10 text-white/90 text-[10px] uppercase tracking-wider font-semibold flex items-center gap-1.5">
                        <TypeIcon size={12} /> {item.type}
                      </span>
                      <span className="px-2.5 py-1 rounded-md bg-amber-400/20 backdrop-blur-md border border-amber-400/30 text-amber-400 text-[10px] uppercase tracking-wider font-semibold flex items-center gap-1.5">
                        <Clock size={12} /> Needs Review
                      </span>
                    </div>
                  </div>

                  <div className="p-6 flex-1 flex flex-col relative z-10 -mt-6">
                    <div className="bg-[#000a16]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-5 mb-4">
                      <h3 className="text-xl font-medium text-white mb-2 line-clamp-1">{item.title}</h3>
                      <div className="flex items-center gap-3 text-xs text-white/50 mb-4">
                        <span className="text-white/80">{item.author}</span>
                        <span className="w-1 h-1 rounded-full bg-white/20" />
                        <span>Submitted {item.submittedAt}</span>
                      </div>
                      
                      <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-sm text-white/70">
                        <span className="text-[10px] uppercase tracking-widest text-[#3DA9E0] font-semibold block mb-1">Editor Notes</span>
                        "{item.changes}"
                      </div>
                    </div>

                    <div className="mt-auto grid grid-cols-3 gap-3">
                      <Link 
                        to={item.path}
                        className="flex flex-col items-center justify-center gap-2 py-3 rounded-xl border border-white/10 text-white/70 hover:text-white hover:bg-white/5 transition-colors"
                      >
                        <Eye size={18} />
                        <span className="text-xs font-medium">Preview</span>
                      </Link>
                      <button 
                        onClick={() => handleReject(item.id)}
                        className="flex flex-col items-center justify-center gap-2 py-3 rounded-xl border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <XCircle size={18} />
                        <span className="text-xs font-medium">Reject</span>
                      </button>
                      <button 
                        onClick={() => handleApprove(item.id)}
                        disabled={isProcessing}
                        className="flex flex-col items-center justify-center gap-2 py-3 rounded-xl bg-[#3DA9E0] text-[#001731] hover:shadow-[0_0_20px_rgba(61,169,224,0.4)] transition-all disabled:opacity-80"
                      >
                        {isProcessing ? (
                          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                            <div className="w-4 h-4 border-2 border-[#001731]/30 border-t-[#001731] rounded-full" />
                          </motion.div>
                        ) : (
                          <>
                            <CheckCircle2 size={18} />
                            <span className="text-xs font-bold">Approve</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}
