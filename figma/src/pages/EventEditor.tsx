import {
  Calendar,
  CalendarDays,
  Check,
  ChevronLeft,
  Eye,
  ImageIcon,
  MapPin,
} from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

export function EventEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === "new";
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    title: isNew ? "" : "Fadderullan Main Party",
    date: "2026-08-15T21:00",
    location: "Oslo Spektrum",
    image:
      "https://images.unsplash.com/photo-1772251784323-5e317816a8de?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxldmVudCUyMGNvbmNlcnQlMjBjcm93ZCUyMGRhcmt8ZW58MXx8fHwxNzc1MjkyNTI4fDA&ixlib=rb-4.1.0&q=80&w=1080",
    price: "250",
    status: "draft",
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
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-[1400px] pb-12"
      initial={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.5 }}
    >
      <header className="sticky top-0 z-20 -mt-4 mb-8 flex flex-col justify-between gap-6 border-white/10 border-b bg-[#000a16]/90 pt-4 pb-8 backdrop-blur-xl md:flex-row md:items-center">
        <div className="flex items-center gap-4">
          <button
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/50 transition-all hover:bg-white/10 hover:text-white"
            onClick={() => navigate("/events")}
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-light text-2xl text-white tracking-tight">
                {isNew ? "Create Event" : "Edit Event"}
              </h1>
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[10px] text-white/40 uppercase tracking-widest">
                {formData.status}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <Link
                className="text-white/40 text-xs transition-colors hover:text-[#3DA9E0]"
                to="/events"
              >
                Events
              </Link>
              <span className="text-white/20 text-xs">/</span>
              <span className="max-w-[200px] truncate text-white/40 text-xs">
                {formData.title || "Untitled"}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            className="rounded-full border border-white/10 px-5 py-2.5 font-medium text-sm text-white/70 transition-all hover:bg-white/5"
            onClick={() => navigate("/events")}
          >
            Discard
          </button>
          <button
            className="flex items-center gap-2 rounded-full bg-[#3DA9E0] px-6 py-2.5 font-bold text-[#001731] text-sm shadow-[0_0_20px_rgba(61,169,224,0.3)] transition-all hover:shadow-[0_0_30px_rgba(61,169,224,0.5)] disabled:opacity-50"
            disabled={isSaving}
            onClick={handleSave}
          >
            {isSaving ? (
              "Publishing..."
            ) : (
              <>
                <Check size={16} /> Publish Live
              </>
            )}
          </button>
        </div>
      </header>

      <div className="flex flex-col items-start gap-12 lg:flex-row lg:gap-16">
        {/* Left: Editorial Form */}
        <div className="w-full flex-1 space-y-16">
          <section>
            <input
              className="w-full border-transparent border-b border-none bg-transparent pb-4 font-light text-4xl text-white tracking-tight outline-none transition-all placeholder:text-white/20 focus:border-[#3DA9E0]/50 focus:border-b md:text-5xl"
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              placeholder="Enter event title..."
              type="text"
              value={formData.title}
            />
          </section>

          <section className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <div className="space-y-2">
              <label className="flex items-center gap-2 font-semibold text-[#3DA9E0] text-[11px] uppercase tracking-widest">
                <CalendarDays size={12} /> Start Date & Time
              </label>
              <input
                className="w-full border-white/10 border-b bg-transparent pb-2 text-lg text-white outline-none transition-colors [color-scheme:dark] focus:border-[#3DA9E0]"
                onChange={(e) =>
                  setFormData({ ...formData, date: e.target.value })
                }
                type="datetime-local"
                value={formData.date}
              />
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 font-semibold text-[#3DA9E0] text-[11px] uppercase tracking-widest">
                <MapPin size={12} /> Location
              </label>
              <input
                className="w-full border-white/10 border-b bg-transparent pb-2 text-lg text-white outline-none transition-colors focus:border-[#3DA9E0]"
                onChange={(e) =>
                  setFormData({ ...formData, location: e.target.value })
                }
                placeholder="e.g. Campus Kroa"
                type="text"
                value={formData.location}
              />
            </div>
          </section>

          <section className="relative space-y-8 border-white/10 border-l pl-8">
            <div className="absolute top-0 -left-[1.5px] h-8 w-[3px] rounded-r-full bg-[#3DA9E0]" />
            <div className="space-y-4">
              <label className="font-semibold text-[11px] text-white/50 uppercase tracking-widest">
                Event Details
              </label>
              <textarea
                className="custom-scrollbar w-full resize-none rounded-2xl border border-white/[0.05] bg-white/[0.02] p-6 text-white/90 leading-relaxed outline-none transition-colors focus:border-[#3DA9E0]/50"
                placeholder="Write a captivating description of what to expect..."
                rows={6}
              />
            </div>
            <div className="grid grid-cols-1 gap-8 pt-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="flex items-center gap-2 font-semibold text-[11px] text-white/50 uppercase tracking-widest">
                  <ImageIcon size={12} /> Cover Image URL
                </label>
                <input
                  className="w-full border-white/10 border-b bg-transparent pb-2 text-white outline-none transition-colors focus:border-[#3DA9E0]"
                  onChange={(e) =>
                    setFormData({ ...formData, image: e.target.value })
                  }
                  placeholder="https://..."
                  type="url"
                  value={formData.image}
                />
              </div>
              <div className="space-y-2">
                <label className="font-semibold text-[11px] text-white/50 uppercase tracking-widest">
                  Ticket Price (NOK)
                </label>
                <input
                  className="w-full border-white/10 border-b bg-transparent pb-2 text-white outline-none transition-colors focus:border-[#3DA9E0]"
                  onChange={(e) =>
                    setFormData({ ...formData, price: e.target.value })
                  }
                  placeholder="0 for free"
                  type="number"
                  value={formData.price}
                />
              </div>
            </div>
          </section>
        </div>

        {/* Right: Sticky Cinematic Preview */}
        <div className="sticky top-32 w-full shrink-0 lg:w-[400px]">
          <div className="mb-4 flex items-center gap-2 px-2">
            <Eye className="text-[#3DA9E0]" size={14} />
            <span className="font-mono text-white/50 text-xs uppercase tracking-widest">
              App Preview
            </span>
          </div>

          <div className="group relative aspect-[4/5] overflow-hidden rounded-3xl border border-white/10 bg-[#001731] shadow-2xl">
            {formData.image ? (
              <img
                alt="Event Cover"
                className="absolute inset-0 h-full w-full object-cover opacity-80 transition-transform duration-700 group-hover:scale-105"
                src={formData.image}
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-[#001731] to-[#000a16]" />
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-[#00050d] via-[#00050d]/60 to-transparent" />

            <div className="absolute inset-0 flex flex-col justify-end p-8">
              <div className="mb-auto self-end">
                <span className="rounded-full border border-white/10 bg-black/40 px-3 py-1 font-bold text-[10px] text-white uppercase tracking-widest backdrop-blur-md">
                  {formData.price && Number(formData.price) > 0
                    ? `NOK ${formData.price}`
                    : "Free Entry"}
                </span>
              </div>

              <div>
                <div className="mb-3 flex items-center gap-3 font-medium text-sm text-white/80">
                  <span className="flex items-center gap-1.5 rounded-md bg-[#3DA9E0]/20 px-2 py-1 text-[#3DA9E0] text-xs">
                    <Calendar size={14} /> Aug 15
                  </span>
                  <span className="flex items-center gap-1.5">
                    <MapPin size={14} /> {formData.location || "TBA"}
                  </span>
                </div>
                <h3 className="mb-6 font-semibold text-3xl text-white leading-tight">
                  {formData.title || "Untitled Event"}
                </h3>
                <button className="w-full rounded-xl bg-[#3DA9E0] py-4 font-bold text-[#001731] text-sm shadow-[0_0_20px_rgba(61,169,224,0.4)] transition-all hover:shadow-[0_0_30px_rgba(61,169,224,0.6)]">
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
