import {
  ArrowUpRight,
  Building2,
  Check,
  ChevronLeft,
  Eye,
  LayoutList,
  MapPin,
} from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

export function JobEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === "new";
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    title: isNew ? "" : "Senior Frontend Developer",
    company: "TechCorp Oslo",
    type: "Full-time",
    location: "oslo",
    status: "draft",
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
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-[1400px] pb-12"
      initial={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.5 }}
    >
      <header className="sticky top-0 z-20 -mt-4 mb-8 flex flex-col justify-between gap-6 border-white/10 border-b bg-[#000a16]/90 pt-4 pb-8 backdrop-blur-xl md:flex-row md:items-center">
        <div className="flex items-center gap-4">
          <button
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/50 transition-all hover:bg-white/10 hover:text-white"
            onClick={() => navigate("/jobs")}
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-light text-2xl text-white tracking-tight">
                {isNew ? "New Job Post" : "Edit Job Post"}
              </h1>
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[10px] text-white/40 uppercase tracking-widest">
                {formData.status}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <Link
                className="text-white/40 text-xs transition-colors hover:text-[#3DA9E0]"
                to="/jobs"
              >
                Jobs
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
            onClick={() => navigate("/jobs")}
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
              placeholder="Enter job title..."
              type="text"
              value={formData.title}
            />
          </section>

          <section className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <div className="space-y-2">
              <label className="font-semibold text-[#3DA9E0] text-[11px] uppercase tracking-widest">
                Company Name
              </label>
              <input
                className="w-full border-white/10 border-b bg-transparent pb-2 text-lg text-white outline-none transition-colors focus:border-[#3DA9E0]"
                onChange={(e) =>
                  setFormData({ ...formData, company: e.target.value })
                }
                placeholder="e.g. TechCorp Oslo"
                type="text"
                value={formData.company}
              />
            </div>
            <div className="space-y-2">
              <label className="font-semibold text-[#3DA9E0] text-[11px] uppercase tracking-widest">
                Employment Type
              </label>
              <select
                className="w-full appearance-none border-white/10 border-b bg-transparent pb-2 text-lg text-white outline-none transition-colors focus:border-[#3DA9E0]"
                onChange={(e) =>
                  setFormData({ ...formData, type: e.target.value })
                }
                value={formData.type}
              >
                <option className="bg-[#000a16]" value="Full-time">
                  Full-time
                </option>
                <option className="bg-[#000a16]" value="Part-time">
                  Part-time
                </option>
                <option className="bg-[#000a16]" value="Internship">
                  Internship
                </option>
                <option className="bg-[#000a16]" value="Graduate">
                  Graduate
                </option>
              </select>
            </div>
          </section>

          <section className="relative space-y-8 border-white/10 border-l pl-8">
            <div className="absolute top-0 -left-[1.5px] h-8 w-[3px] rounded-r-full bg-[#3DA9E0]" />
            <div className="space-y-4">
              <label className="font-semibold text-[11px] text-white/50 uppercase tracking-widest">
                The Role (EN)
              </label>
              <textarea
                className="custom-scrollbar w-full resize-none rounded-2xl border border-white/[0.05] bg-white/[0.02] p-6 text-white/90 leading-relaxed outline-none transition-colors focus:border-[#3DA9E0]/50"
                placeholder="Write a compelling job description..."
                rows={6}
              />
            </div>
            <div className="space-y-4">
              <label className="font-semibold text-[11px] text-white/50 uppercase tracking-widest">
                The Role (NO)
              </label>
              <textarea
                className="custom-scrollbar w-full resize-none rounded-2xl border border-white/[0.05] bg-white/[0.02] p-6 text-white/90 leading-relaxed outline-none transition-colors focus:border-[#3DA9E0]/50"
                placeholder="Skriv en overbevisende stillingsbeskrivelse..."
                rows={6}
              />
            </div>
          </section>

          <section className="grid grid-cols-1 gap-8 border-white/10 border-t pt-8 md:grid-cols-2">
            <div className="space-y-2">
              <label className="flex items-center gap-2 font-semibold text-[11px] text-white/50 uppercase tracking-widest">
                <MapPin size={12} /> Target Campus
              </label>
              <select
                className="w-full appearance-none border-white/10 border-b bg-transparent pb-2 text-white outline-none transition-colors focus:border-[#3DA9E0]"
                onChange={(e) =>
                  setFormData({ ...formData, location: e.target.value })
                }
                value={formData.location}
              >
                <option className="bg-[#000a16]" value="oslo">
                  BI Oslo
                </option>
                <option className="bg-[#000a16]" value="bergen">
                  BI Bergen
                </option>
                <option className="bg-[#000a16]" value="trondheim">
                  BI Trondheim
                </option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 font-semibold text-[11px] text-white/50 uppercase tracking-widest">
                <LayoutList size={12} /> URL Slug
              </label>
              <div className="flex border-white/10 border-b pb-2 transition-colors focus-within:border-[#3DA9E0]">
                <span className="mt-0.5 mr-1 text-sm text-white/30">
                  /jobs/
                </span>
                <input
                  className="flex-1 bg-transparent text-white outline-none"
                  placeholder="role-title"
                  type="text"
                />
              </div>
            </div>
          </section>
        </div>

        {/* Right: Sticky Cinematic Preview */}
        <div className="sticky top-32 w-full shrink-0 lg:w-[420px]">
          <div className="mb-4 flex items-center gap-2 px-2">
            <Eye className="text-[#3DA9E0]" size={14} />
            <span className="font-mono text-white/50 text-xs uppercase tracking-widest">
              Live Preview
            </span>
          </div>

          <div className="group relative overflow-hidden rounded-3xl border border-white/[0.05] bg-gradient-to-br from-white/[0.05] to-transparent p-8 backdrop-blur-xl">
            {/* Ambient background blur */}
            <div className="pointer-events-none absolute top-0 right-0 h-64 w-64 translate-x-1/2 -translate-y-1/2 rounded-full bg-[#3DA9E0]/10 blur-[80px]" />

            <div className="relative z-10 space-y-6">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-[#001731]">
                <Building2 className="text-[#3DA9E0]/50" size={24} />
              </div>

              <div>
                <div className="mb-3 flex items-center gap-2">
                  <span className="rounded-full border border-white/5 bg-white/10 px-2.5 py-1 font-semibold text-[10px] text-white/80 uppercase tracking-wider">
                    {formData.type}
                  </span>
                  <span className="rounded-full border border-[#3DA9E0]/20 bg-[#3DA9E0]/10 px-2.5 py-1 font-semibold text-[#3DA9E0] text-[10px] uppercase tracking-wider">
                    {formData.location.toUpperCase()}
                  </span>
                </div>
                <h3 className="mb-2 font-light text-2xl text-white leading-tight">
                  {formData.title || "Untitled Role"}
                </h3>
                <p className="text-sm text-white/50">{formData.company}</p>
              </div>

              <div className="border-white/10 border-t pt-6">
                <div className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-white py-3 font-semibold text-black text-sm transition-colors hover:bg-gray-200">
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
