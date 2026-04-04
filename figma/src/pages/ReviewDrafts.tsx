import {
  Briefcase,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Eye,
  FileText,
  Type,
  XCircle,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Link } from "react-router";

const DRAFT_ITEMS = [
  {
    id: "d1",
    title: "Fadderullan Main Party 2026",
    type: "event",
    author: "Event Team",
    submittedAt: "2 hours ago",
    image:
      "https://images.unsplash.com/photo-1772251784323-5e317816a8de?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxldmVudCUyMGNvbmNlcnQlMjBjcm93ZCUyMGRhcmt8ZW58MXx8fHwxNzc1MjkyNTI4fDA&ixlib=rb-4.1.0&q=80&w=1080",
    changes: "Updated ticket URL and start time",
    path: "/events/1",
  },
  {
    id: "d2",
    title: "Student Life Overview",
    type: "page",
    author: "Sarah Jenkins",
    submittedAt: "5 hours ago",
    image:
      "https://images.unsplash.com/photo-1632834380561-d1e05839a33a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx1bml2ZXJzaXR5JTIwY2FtcHVzJTIwc3R1ZGVudHN8ZW58MXx8fHwxNzc1Mjg5MTQ3fDA&ixlib=rb-4.1.0&q=80&w=1080",
    changes: "New hero image and updated benefits section",
    path: "/editor/2",
  },
  {
    id: "d3",
    title: "Marketing Intern (Oslo)",
    type: "job",
    author: "Admin",
    submittedAt: "1 day ago",
    image:
      "https://images.unsplash.com/photo-1668714341253-81139e265a19?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxvZmZpY2UlMjB3b3Jrc3BhY2UlMjB0ZWNoJTIwZGFya3xlbnwxfHx8fDE3NzUyOTMwODB8MA&ixlib=rb-4.1.0&q=80&w=1080",
    changes: "Initial creation",
    path: "/jobs/2",
  },
  {
    id: "d4",
    title: "BISO launches new AI-driven platform",
    type: "news",
    author: "Alex Editor",
    submittedAt: "2 days ago",
    image:
      "https://images.unsplash.com/photo-1762793194390-4eaf3673f045?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxuZXdzcGFwZXIlMjBhcnRpY2xlJTIwbW9kZXJuJTIwZGFya3xlbnwxfHx8fDE3NzUyOTMwODB8MA&ixlib=rb-4.1.0&q=80&w=1080",
    changes: "Drafted press release for main page",
    path: "/news/1",
  },
];

const TYPE_ICONS = {
  page: FileText,
  job: Briefcase,
  event: CalendarDays,
  news: Type,
};

export function ReviewDrafts() {
  const [items, setItems] = useState(DRAFT_ITEMS);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleApprove = (id: string) => {
    setProcessingId(id);
    setTimeout(() => {
      setItems(items.filter((item) => item.id !== id));
      setProcessingId(null);
    }, 800);
  };

  const handleReject = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
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
            to="/"
          >
            <ChevronLeft size={20} />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-light text-3xl text-white tracking-tight md:text-4xl">
                Review Queue
              </h1>
              <span className="rounded-full bg-amber-400/10 px-3 py-1 font-bold font-mono text-amber-400 text-xs">
                {items.length} Pending
              </span>
            </div>
            <p className="mt-1 text-sm text-white/50">
              Review, approve, or reject content submitted by editors.
            </p>
          </div>
        </div>
      </header>

      {items.length === 0 ? (
        <motion.div
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center py-32 text-center"
          initial={{ opacity: 0, scale: 0.95 }}
        >
          <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-white/5">
            <CheckCircle2 className="text-emerald-400" size={48} />
          </div>
          <h2 className="mb-2 font-light text-2xl text-white">
            All caught up!
          </h2>
          <p className="text-white/50">
            There are no pending drafts waiting for review.
          </p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <AnimatePresence>
            {items.map((item) => {
              const TypeIcon = TYPE_ICONS[item.type as keyof typeof TYPE_ICONS];
              const isProcessing = processingId === item.id;

              return (
                <motion.div
                  animate={{ opacity: 1, scale: 1 }}
                  className="group flex flex-col overflow-hidden rounded-3xl border border-white/5 bg-white/2 backdrop-blur-sm"
                  exit={{
                    opacity: 0,
                    scale: 0.9,
                    transition: { duration: 0.2 },
                  }}
                  initial={{ opacity: 0, scale: 0.95 }}
                  key={item.id}
                  layout
                >
                  <div className="relative h-40 overflow-hidden bg-[#001731]">
                    <img
                      alt={item.title}
                      className="h-full w-full object-cover opacity-60 transition-transform duration-700 group-hover:scale-105"
                      src={item.image}
                    />
                    <div className="absolute inset-0 bg-linear-to-t from-[#000a16] via-[#000a16]/40 to-transparent" />

                    <div className="absolute top-4 left-4 flex gap-2">
                      <span className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/10 px-2.5 py-1 font-semibold text-[10px] text-white/90 uppercase tracking-wider backdrop-blur-md">
                        <TypeIcon size={12} /> {item.type}
                      </span>
                      <span className="flex items-center gap-1.5 rounded-md border border-amber-400/30 bg-amber-400/20 px-2.5 py-1 font-semibold text-[10px] text-amber-400 uppercase tracking-wider backdrop-blur-md">
                        <Clock size={12} /> Needs Review
                      </span>
                    </div>
                  </div>

                  <div className="relative z-10 -mt-6 flex flex-1 flex-col p-6">
                    <div className="mb-4 rounded-2xl border border-white/10 bg-[#000a16]/90 p-5 backdrop-blur-xl">
                      <h3 className="mb-2 line-clamp-1 font-medium text-white text-xl">
                        {item.title}
                      </h3>
                      <div className="mb-4 flex items-center gap-3 text-white/50 text-xs">
                        <span className="text-white/80">{item.author}</span>
                        <span className="h-1 w-1 rounded-full bg-white/20" />
                        <span>Submitted {item.submittedAt}</span>
                      </div>

                      <div className="rounded-xl border border-white/5 bg-white/5 p-3 text-sm text-white/70">
                        <span className="mb-1 block font-semibold text-[#3DA9E0] text-[10px] uppercase tracking-widest">
                          Editor Notes
                        </span>
                        "{item.changes}"
                      </div>
                    </div>

                    <div className="mt-auto grid grid-cols-3 gap-3">
                      <Link
                        className="flex flex-col items-center justify-center gap-2 rounded-xl border border-white/10 py-3 text-white/70 transition-colors hover:bg-white/5 hover:text-white"
                        to={item.path}
                      >
                        <Eye size={18} />
                        <span className="font-medium text-xs">Preview</span>
                      </Link>
                      <button
                        className="flex flex-col items-center justify-center gap-2 rounded-xl border border-red-500/20 py-3 text-red-400 transition-colors hover:bg-red-500/10"
                        onClick={() => handleReject(item.id)}
                      >
                        <XCircle size={18} />
                        <span className="font-medium text-xs">Reject</span>
                      </button>
                      <button
                        className="flex flex-col items-center justify-center gap-2 rounded-xl bg-[#3DA9E0] py-3 text-[#001731] transition-all hover:shadow-[0_0_20px_rgba(61,169,224,0.4)] disabled:opacity-80"
                        disabled={isProcessing}
                        onClick={() => handleApprove(item.id)}
                      >
                        {isProcessing ? (
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{
                              repeat: Number.POSITIVE_INFINITY,
                              duration: 1,
                              ease: "linear",
                            }}
                          >
                            <div className="h-4 w-4 rounded-full border-2 border-[#001731]/30 border-t-[#001731]" />
                          </motion.div>
                        ) : (
                          <>
                            <CheckCircle2 size={18} />
                            <span className="font-bold text-xs">Approve</span>
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
