import {
  ChevronLeft,
  Coffee,
  Gift,
  Globe,
  Image as ImageIcon,
  MapPin,
  Percent,
  QrCode,
  Save,
  Ticket,
} from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { Link } from "react-router";

export function BenefitEditor() {
  const [scope, setScope] = useState<"National" | "Campus">("National");
  const [type, setType] = useState("Discount");

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col gap-8 pb-12 lg:flex-row">
      {/* Left Pane: Editor Form */}
      <motion.div
        animate={{ opacity: 1, x: 0 }}
        className="flex w-full flex-col lg:w-[55%]"
        initial={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.5 }}
      >
        <header className="sticky top-0 z-20 mb-8 flex items-center justify-between border-white/10 border-b bg-[#000a16]/90 py-4 backdrop-blur-xl">
          <div className="flex items-center gap-4">
            <Link
              className="rounded-lg p-2 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
              to="/benefits"
            >
              <ChevronLeft size={20} />
            </Link>
            <div>
              <h1 className="font-light text-2xl text-white">Edit Benefit</h1>
              <p className="mt-0.5 font-mono text-sm text-white/40">
                ID: ben_194x8f
              </p>
            </div>
          </div>
          <button className="flex items-center gap-2 rounded-xl bg-[#3DA9E0] px-6 py-2.5 font-semibold text-[#001731] shadow-[0_0_20px_rgba(61,169,224,0.3)] transition-all hover:shadow-[0_0_30px_rgba(61,169,224,0.5)]">
            <Save size={18} />
            Publish
          </button>
        </header>

        <div className="flex-1 space-y-8 pr-2">
          {/* Scope Selection */}
          <section className="rounded-3xl border border-white/[0.05] bg-white/[0.02] p-6 backdrop-blur-sm">
            <h2 className="mb-6 font-bold text-sm text-white/40 uppercase tracking-widest">
              Target Audience
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <button
                className={`rounded-xl border p-4 text-left transition-all ${
                  scope === "National"
                    ? "border-[#3DA9E0]/30 bg-[#3DA9E0]/10 shadow-[0_0_15px_rgba(61,169,224,0.1)]"
                    : "border-white/10 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white"
                }`}
                onClick={() => setScope("National")}
              >
                <Globe
                  className={`mb-3 ${scope === "National" ? "text-[#3DA9E0]" : ""}`}
                  size={24}
                />
                <h3
                  className={`font-medium ${scope === "National" ? "text-[#3DA9E0]" : ""}`}
                >
                  National
                </h3>
                <p className="mt-1 text-xs opacity-70">
                  Available to all BISO members globally.
                </p>
              </button>

              <button
                className={`rounded-xl border p-4 text-left transition-all ${
                  scope === "Campus"
                    ? "border-emerald-400/30 bg-emerald-400/10 shadow-[0_0_15px_rgba(52,211,153,0.1)]"
                    : "border-white/10 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white"
                }`}
                onClick={() => setScope("Campus")}
              >
                <MapPin
                  className={`mb-3 ${scope === "Campus" ? "text-emerald-400" : ""}`}
                  size={24}
                />
                <h3
                  className={`font-medium ${scope === "Campus" ? "text-emerald-400" : ""}`}
                >
                  Campus Specific
                </h3>
                <p className="mt-1 text-xs opacity-70">
                  Restricted to members of a single campus.
                </p>
              </button>
            </div>

            {scope === "Campus" && (
              <div className="mt-4 border-white/10 border-t pt-4">
                <label className="mb-2 block font-medium text-sm text-white/70">
                  Select Campus
                </label>
                <select className="w-full appearance-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition-colors focus:border-[#3DA9E0]">
                  <option>Oslo</option>
                  <option>Bergen</option>
                  <option>Stavanger</option>
                  <option>Trondheim</option>
                </select>
              </div>
            )}
          </section>

          {/* Basic Details */}
          <section className="space-y-5 rounded-3xl border border-white/[0.05] bg-white/[0.02] p-6 backdrop-blur-sm">
            <h2 className="mb-4 font-bold text-sm text-white/40 uppercase tracking-widest">
              Benefit Details
            </h2>

            <div className="grid grid-cols-2 gap-5">
              <div className="col-span-2">
                <label className="mb-2 block font-medium text-sm text-white/70">
                  Benefit Title
                </label>
                <input
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition-colors focus:border-[#3DA9E0]"
                  defaultValue="20% Off All Beverages"
                  type="text"
                />
              </div>

              <div>
                <label className="mb-2 block font-medium text-sm text-white/70">
                  Provider / Partner Name
                </label>
                <input
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition-colors focus:border-[#3DA9E0]"
                  defaultValue="Espresso House"
                  type="text"
                />
              </div>

              <div>
                <label className="mb-2 block font-medium text-sm text-white/70">
                  Type
                </label>
                <div className="relative">
                  <select
                    className="w-full appearance-none rounded-xl border border-white/10 bg-white/5 py-3 pr-4 pl-10 text-white outline-none transition-colors focus:border-[#3DA9E0]"
                    onChange={(e) => setType(e.target.value)}
                    value={type}
                  >
                    <option>Discount</option>
                    <option>Service</option>
                    <option>Access</option>
                    <option>Other</option>
                  </select>
                  <div className="absolute top-1/2 left-3.5 -translate-y-1/2 text-white/50">
                    {type === "Discount" && <Percent size={16} />}
                    {type === "Service" && <Coffee size={16} />}
                    {type === "Access" && <Ticket size={16} />}
                    {type === "Other" && <Gift size={16} />}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="mb-2 block font-medium text-sm text-white/70">
                Description
              </label>
              <textarea
                className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition-colors focus:border-[#3DA9E0]"
                defaultValue="Get a 20% discount on all hot and cold beverages at any Espresso House location in Norway. Just show your active BISO membership in the app at the counter."
                rows={3}
              />
            </div>
          </section>

          {/* Redemption Details */}
          <section className="space-y-5 rounded-3xl border border-white/[0.05] bg-white/[0.02] p-6 backdrop-blur-sm">
            <h2 className="mb-4 font-bold text-sm text-white/40 uppercase tracking-widest">
              Redemption
            </h2>

            <div>
              <label className="mb-2 block font-medium text-sm text-white/70">
                How do students claim this?
              </label>
              <select className="w-full appearance-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition-colors focus:border-[#3DA9E0]">
                <option>Show Active Membership Screen</option>
                <option>Promo Code</option>
                <option>External Link</option>
                <option>QR Code Scan</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block font-medium text-sm text-white/70">
                Redemption Instructions (Optional)
              </label>
              <input
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition-colors focus:border-[#3DA9E0]"
                defaultValue="Show this screen to the barista before paying."
                placeholder="e.g., Show this screen to the barista before paying."
                type="text"
              />
            </div>
          </section>

          {/* Image */}
          <section className="rounded-3xl border border-white/[0.05] bg-white/[0.02] p-6 backdrop-blur-sm">
            <h2 className="mb-4 font-bold text-sm text-white/40 uppercase tracking-widest">
              Cover Image
            </h2>
            <div className="group relative flex h-48 w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-white/20 border-dashed bg-white/5 text-white/50 transition-all hover:border-[#3DA9E0] hover:bg-white/10 hover:text-white">
              <img
                alt="Cover"
                className="absolute inset-0 h-full w-full object-cover opacity-60 transition-opacity group-hover:opacity-30"
                src="https://images.unsplash.com/photo-1554118811-1e0d58224f24?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb2ZmZWUlMjBzaG9wfGVufDF8fHx8MTc3NTI5NjAwMHww&ixlib=rb-4.1.0&q=80&w=1080"
              />
              <div className="relative z-10 flex flex-col items-center gap-2">
                <ImageIcon size={24} />
                <span className="font-medium text-sm">Replace Image</span>
              </div>
            </div>
          </section>
        </div>
      </motion.div>

      {/* Right Pane: Live Preview */}
      <motion.div
        animate={{ opacity: 1, x: 0 }}
        className="flex h-fit w-full flex-col items-center justify-center pt-8 lg:sticky lg:top-8 lg:w-[45%] lg:pt-16"
        initial={{ opacity: 0, x: 20 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <div className="mb-8 text-center">
          <h3 className="mb-2 font-mono text-sm text-white/50 uppercase tracking-widest">
            Live App Preview
          </h3>
          <p className="text-white/30 text-xs">
            This is how the benefit appears in the student app
          </p>
        </div>

        {/* Mobile Device Mockup */}
        <div className="relative flex h-[650px] w-[320px] flex-col overflow-hidden rounded-[40px] border-[#001731] border-[8px] bg-black shadow-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)]">
          {/* Dynamic Island fake */}
          <div className="absolute inset-x-0 top-0 z-50 flex h-6 justify-center">
            <div className="h-5 w-24 rounded-b-xl bg-[#001731]" />
          </div>

          <div className="hide-scrollbar flex-1 overflow-y-auto bg-[#000a16] pb-10">
            {/* Header Image */}
            <div className="relative h-64 bg-[#001731]">
              <img
                alt="Preview"
                className="h-full w-full object-cover opacity-80"
                src="https://images.unsplash.com/photo-1554118811-1e0d58224f24?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb2ZmZWUlMjBzaG9wfGVufDF8fHx8MTc3NTI5NjAwMHww&ixlib=rb-4.1.0&q=80&w=1080"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#000a16] via-[#000a16]/20 to-transparent" />

              <div className="absolute top-10 left-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/50 text-white backdrop-blur-md">
                  <ChevronLeft size={16} />
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="relative z-10 -mt-8 px-5">
              <div className="mb-3 flex gap-2">
                <span
                  className={`flex items-center gap-1 rounded-full border bg-[#000a16]/80 px-2.5 py-1 font-bold text-[9px] uppercase tracking-wider backdrop-blur-md ${
                    scope === "National"
                      ? "border-[#3DA9E0]/30 text-[#3DA9E0]"
                      : "border-emerald-400/30 text-emerald-400"
                  }`}
                >
                  {scope === "National" ? (
                    <Globe size={10} />
                  ) : (
                    <MapPin size={10} />
                  )}
                  {scope}
                </span>
                <span className="flex items-center gap-1 rounded-full border border-white/10 bg-[#000a16]/80 px-2.5 py-1 font-bold text-[9px] text-white/70 uppercase tracking-wider backdrop-blur-md">
                  {type === "Discount" && <Percent size={10} />}
                  {type === "Service" && <Coffee size={10} />}
                  {type === "Access" && <Ticket size={10} />}
                  {type === "Other" && <Gift size={10} />}
                  {type}
                </span>
              </div>

              <h1 className="mb-1 font-medium text-2xl text-white leading-tight">
                20% Off All Beverages
              </h1>
              <p className="mb-6 font-medium text-[#3DA9E0] text-sm">
                Espresso House
              </p>

              <p className="mb-8 text-sm text-white/70 leading-relaxed">
                Get a 20% discount on all hot and cold beverages at any Espresso
                House location in Norway. Just show your active BISO membership
                in the app at the counter.
              </p>

              {/* Redemption Card */}
              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-5 text-center">
                <div className="absolute inset-0 bg-gradient-to-br from-[#3DA9E0]/10 to-transparent opacity-50" />
                <div className="relative z-10">
                  <QrCode className="mx-auto mb-3 text-white/30" size={48} />
                  <p className="font-medium text-sm text-white">
                    Active Membership Required
                  </p>
                  <p className="mt-1 mb-4 text-white/50 text-xs">
                    Show this screen to the barista before paying.
                  </p>
                  <div className="rounded-xl bg-[#3DA9E0] py-3 font-bold text-[#001731] shadow-[0_0_15px_rgba(61,169,224,0.3)]">
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
