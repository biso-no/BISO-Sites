import {
  Check,
  ChevronLeft,
  Eye,
  ImageIcon,
  PenTool,
  Type,
} from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

export function NewsEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === "new";
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    title: isNew ? "" : "BISO launches new AI-driven campus platform",
    author: "Alex Editor",
    category: "Technology",
    image:
      "https://images.unsplash.com/photo-1762793194390-4eaf3673f045?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxuZXdzcGFwZXIlMjBhcnRpY2xlJTIwbW9kZXJuJTIwZGFya3xlbnwxfHx8fDE3NzUyOTMwODB8MA&ixlib=rb-4.1.0&q=80&w=1080",
    status: "draft",
    content: "",
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
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-[1400px] pb-12"
      initial={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.5 }}
    >
      <header className="sticky top-0 z-20 -mt-4 mb-8 flex flex-col justify-between gap-6 border-white/10 border-b bg-[#000a16]/90 pt-4 pb-8 backdrop-blur-xl md:flex-row md:items-center">
        <div className="flex items-center gap-4">
          <button
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/50 transition-all hover:bg-white/10 hover:text-white"
            onClick={() => navigate("/news")}
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-light text-2xl text-white tracking-tight">
                {isNew ? "Write Article" : "Edit Article"}
              </h1>
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[10px] text-white/40 uppercase tracking-widest">
                {formData.status}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <Link
                className="text-white/40 text-xs transition-colors hover:text-[#3DA9E0]"
                to="/news"
              >
                News
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
            onClick={() => navigate("/news")}
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
                <Check size={16} /> Publish Article
              </>
            )}
          </button>
        </div>
      </header>

      <div className="flex flex-col items-start gap-12 lg:flex-row lg:gap-16">
        {/* Left: Editorial Form */}
        <div className="w-full flex-1 space-y-12">
          <section>
            <textarea
              className="w-full resize-none border-transparent border-b border-none bg-transparent pb-4 font-serif text-4xl text-white outline-none transition-all placeholder:text-white/20 focus:border-[#3DA9E0]/50 focus:border-b md:text-6xl"
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              placeholder="Headline..."
              rows={2}
              value={formData.title}
            />
          </section>

          <section className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <div className="space-y-2">
              <label className="flex items-center gap-2 font-semibold text-[#3DA9E0] text-[11px] uppercase tracking-widest">
                <PenTool size={12} /> Author
              </label>
              <input
                className="w-full border-white/10 border-b bg-transparent pb-2 text-lg text-white outline-none transition-colors focus:border-[#3DA9E0]"
                onChange={(e) =>
                  setFormData({ ...formData, author: e.target.value })
                }
                type="text"
                value={formData.author}
              />
            </div>
            <div className="space-y-2">
              <label className="font-semibold text-[#3DA9E0] text-[11px] uppercase tracking-widest">
                Category
              </label>
              <select
                className="w-full appearance-none border-white/10 border-b bg-transparent pb-2 text-lg text-white outline-none transition-colors focus:border-[#3DA9E0]"
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value })
                }
                value={formData.category}
              >
                <option className="bg-[#000a16]" value="Technology">
                  Technology
                </option>
                <option className="bg-[#000a16]" value="Campus Politics">
                  Campus Politics
                </option>
                <option className="bg-[#000a16]" value="Student Life">
                  Student Life
                </option>
              </select>
            </div>
          </section>

          <section className="space-y-4 pt-4">
            <div className="space-y-2">
              <label className="flex items-center gap-2 font-semibold text-[11px] text-white/50 uppercase tracking-widest">
                <ImageIcon size={12} /> Featured Image URL
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
          </section>

          <section className="space-y-4">
            <label className="flex items-center gap-2 font-semibold text-[#3DA9E0] text-[11px] uppercase tracking-widest">
              <Type size={12} /> Body Content
            </label>
            <div className="rounded-2xl border border-white/10 bg-white/1 p-2 transition-colors focus-within:border-[#3DA9E0]/50">
              <textarea
                className="custom-scrollbar w-full resize-none bg-transparent p-4 font-mono text-sm text-white/90 leading-relaxed outline-none"
                onChange={(e) =>
                  setFormData({ ...formData, content: e.target.value })
                }
                placeholder="Write your article in markdown..."
                rows={20}
                value={formData.content}
              />
            </div>
          </section>
        </div>

        {/* Right: Sticky Cinematic Preview */}
        <div className="sticky top-32 w-full shrink-0 lg:w-[450px]">
          <div className="mb-4 flex items-center gap-2 px-2">
            <Eye className="text-[#3DA9E0]" size={14} />
            <span className="font-mono text-white/50 text-xs uppercase tracking-widest">
              Editorial Preview
            </span>
          </div>

          <div className="group overflow-hidden rounded-3xl border border-white/10 bg-[#000a16] shadow-2xl">
            <div className="relative h-64 overflow-hidden bg-[#001731]">
              {formData.image ? (
                <img
                  alt="Article"
                  className="h-full w-full object-cover opacity-80 transition-transform duration-700 group-hover:scale-105"
                  src={formData.image}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <ImageIcon className="text-white/20" size={32} />
                </div>
              )}
            </div>

            <div className="relative z-10 -mt-12 p-8">
              <div className="rounded-2xl border border-white/10 bg-[#00050d]/80 p-6 shadow-xl backdrop-blur-xl">
                <span className="mb-3 block font-bold text-[#3DA9E0] text-[10px] uppercase tracking-widest">
                  {formData.category || "Category"}
                </span>
                <h3 className="mb-4 font-serif text-2xl text-white leading-snug">
                  {formData.title || "Untitled Article"}
                </h3>
                <div className="flex items-center gap-3 text-white/50 text-xs">
                  <span className="font-medium text-white/80">
                    {formData.author || "Author"}
                  </span>
                  <span className="h-1 w-1 rounded-full bg-white/20" />
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
