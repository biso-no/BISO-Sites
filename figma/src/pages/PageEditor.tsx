import {
  Check,
  ChevronLeft,
  Columns,
  Globe,
  History,
  Image as ImageIcon,
  Layers,
  Layout,
  Maximize2,
  Monitor,
  PlayCircle,
  Plus,
  Settings,
  Smartphone,
  Type,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { MOCK_PAGES } from "../data";

export function PageEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"build" | "settings" | "history">(
    "build"
  );
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [isSaving, setIsSaving] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);

  const page = MOCK_PAGES.find((p) => p.id === id) || {
    title: "Untitled Page",
    status: "draft",
  };

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => setIsSaving(false), 1500);
  };

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-[#00050d] font-sans text-white">
      {/* Top Navigation Bar */}
      <header className="z-50 flex h-16 shrink-0 items-center justify-between border-white/10 border-b bg-[#000a16]/80 px-4 backdrop-blur-xl">
        <div className="flex flex-1 items-center gap-4">
          <button
            className="rounded-lg p-2 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
            onClick={() => navigate("/pages")}
          >
            <ChevronLeft size={20} />
          </button>

          <div className="h-6 w-px bg-white/10" />

          <div className="flex flex-col">
            <input
              className="w-64 bg-transparent font-medium text-sm text-white outline-none focus:border-[#3DA9E0]/50 focus:border-b"
              defaultValue={page.title}
              type="text"
            />
            <span className="mt-0.5 flex items-center gap-1 font-mono text-[10px] text-white/40 uppercase tracking-widest">
              <span
                className={`h-1.5 w-1.5 rounded-full ${page.status === "published" ? "bg-[#3DA9E0]" : "bg-white/40"}`}
              />
              {page.status}
            </span>
          </div>
        </div>

        {/* Center Controls (Viewport + Tabs) */}
        <div className="flex flex-1 items-center justify-center gap-6">
          <div className="flex rounded-lg border border-white/10 bg-white/5 p-1">
            <button
              className={`rounded-md p-1.5 transition-all ${device === "desktop" ? "bg-white/10 text-white shadow-sm" : "text-white/40 hover:text-white/80"}`}
              onClick={() => setDevice("desktop")}
            >
              <Monitor size={16} />
            </button>
            <button
              className={`rounded-md p-1.5 transition-all ${device === "mobile" ? "bg-white/10 text-white shadow-sm" : "text-white/40 hover:text-white/80"}`}
              onClick={() => setDevice("mobile")}
            >
              <Smartphone size={16} />
            </button>
          </div>

          <div className="h-6 w-px bg-white/10" />

          <div className="flex gap-1">
            {[
              { id: "build", icon: Layout, label: "Build" },
              { id: "settings", icon: Settings, label: "Settings" },
              { id: "history", icon: History, label: "History" },
            ].map((tab) => (
              <button
                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? "bg-[#3DA9E0]/10 text-[#3DA9E0]"
                    : "text-white/50 hover:bg-white/5 hover:text-white"
                }`}
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
              >
                <tab.icon size={14} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex flex-1 items-center justify-end gap-3">
          <button className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-1.5 text-sm text-white/70 transition-all hover:bg-white/5">
            <Globe size={14} />
            <span className="font-medium">EN</span>
          </button>

          <span className="mr-2 text-white/30 text-xs">
            {isSaving ? "Saving..." : "Saved 2m ago"}
          </span>

          <button
            className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 font-medium text-sm text-white transition-all hover:bg-white/10"
            onClick={handleSave}
          >
            {isSaving ? <Check className="text-[#3DA9E0]" size={14} /> : null}
            Save Draft
          </button>
          <button
            className="rounded-lg bg-[#3DA9E0] px-5 py-2 font-semibold text-[#001731] text-sm shadow-[0_0_15px_rgba(61,169,224,0.3)] transition-all hover:shadow-[0_0_25px_rgba(61,169,224,0.5)]"
            onClick={() => setShowPublishModal(true)}
          >
            Publish
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* Left Panel: Blocks Palette (Only visible in Build mode) */}
        <AnimatePresence>
          {activeTab === "build" && (
            <motion.div
              animate={{ x: 0, opacity: 1 }}
              className="custom-scrollbar z-10 w-72 shrink-0 overflow-y-auto border-white/10 border-r bg-[#000a16]/95 backdrop-blur-md"
              exit={{ x: -300, opacity: 0 }}
              initial={{ x: -300, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
            >
              <div className="p-4">
                <h3 className="mb-4 font-mono text-white/40 text-xs uppercase tracking-widest">
                  Add Elements
                </h3>

                <div className="space-y-6">
                  <BlockCategory
                    items={[
                      {
                        icon: Layers,
                        name: "Hero Section",
                        desc: "Full bleed image & text",
                      },
                      {
                        icon: Columns,
                        name: "Split Content",
                        desc: "Text & media side-by-side",
                      },
                      {
                        icon: Layout,
                        name: "Grid",
                        desc: "Masonry or standard grid",
                      },
                    ]}
                    title="Layout"
                  />

                  <BlockCategory
                    items={[
                      {
                        icon: Type,
                        name: "Rich Text",
                        desc: "Formatted typography",
                      },
                      {
                        icon: ImageIcon,
                        name: "Image/Video",
                        desc: "Single media element",
                      },
                    ]}
                    title="Basic"
                  />

                  <BlockCategory
                    items={[
                      {
                        icon: PlayCircle,
                        name: "Events Carousel",
                        desc: "Upcoming BISO events",
                      },
                      {
                        icon: Maximize2,
                        name: "Job Board Mini",
                        desc: "Latest job postings",
                      },
                    ]}
                    title="Dynamic"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Center: Canvas Canvas Canvas! */}
        <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-black/40 p-8">
          {/* Ambient Glow behind canvas */}
          <div className="pointer-events-none absolute top-1/2 left-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#3DA9E0]/5 blur-[100px]" />

          <motion.div
            className={`relative origin-top overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-white/10 transition-all duration-500 ${device === "mobile" ? "h-[812px] w-[375px]" : "h-full w-full max-w-[1200px]"}
            `}
            layout
          >
            {/* The actual preview rendering would go here. We mock a beautiful high-end page preview. */}
            <div className="custom-scrollbar h-full w-full overflow-y-auto bg-[#040914] text-white">
              {/* Mock Hero Block */}
              <div className="group relative h-[60vh] min-h-[400px] w-full">
                <img
                  alt="Hero"
                  className="h-full w-full object-cover opacity-60"
                  src={page.image || MOCK_PAGES[0].image}
                />
                <div className="absolute inset-0 bg-linear-to-t from-[#040914] via-[#040914]/40 to-transparent" />
                <div className="absolute inset-0 flex flex-col justify-end p-12">
                  <div className="group/edit relative -m-4 cursor-pointer rounded-lg border border-[#3DA9E0]/50 border-dashed p-4 transition-colors hover:bg-[#3DA9E0]/5">
                    <div className="absolute -top-3 -right-3 rounded bg-[#3DA9E0] px-2 py-1 font-bold text-[10px] text-black opacity-0 shadow-lg transition-opacity group-hover/edit:opacity-100">
                      Edit Hero
                    </div>
                    <h1 className="mb-4 font-bold text-5xl tracking-tight md:text-7xl">
                      {page.title}
                    </h1>
                    <p className="max-w-2xl text-white/60 text-xl">
                      A premium digital experience built for students, by
                      students.
                    </p>
                  </div>
                </div>
              </div>

              {/* Mock Content Block */}
              <div className="mx-auto max-w-4xl space-y-8 p-12">
                <div className="group/edit relative cursor-pointer rounded-lg border border-white/20 border-dashed p-6 transition-colors hover:bg-white/5">
                  <div className="absolute -top-3 -right-3 rounded bg-white px-2 py-1 font-bold text-[10px] text-black opacity-0 shadow-lg transition-opacity group-hover/edit:opacity-100">
                    Edit Text
                  </div>
                  <h2 className="mb-4 font-light text-3xl text-[#3DA9E0]">
                    The Future of BISO
                  </h2>
                  <p className="text-lg text-white/70 leading-relaxed">
                    This immersive content block is ready to be edited. Click
                    here to open the rich text editor on the right panel. The
                    cinematic design language pushes boundaries while retaining
                    deep usability.
                  </p>
                </div>
              </div>

              {/* Add Block Placeholder */}
              <div className="mx-12 mb-24 flex h-32 cursor-pointer items-center justify-center rounded-2xl border-2 border-white/10 border-dashed text-white/30 transition-all hover:border-[#3DA9E0]/50 hover:bg-white/5 hover:text-[#3DA9E0]">
                <div className="flex flex-col items-center gap-2">
                  <Plus size={24} />
                  <span className="font-medium text-sm">
                    Drag or Click to Add Block
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Right Panel: Contextual Properties */}
        <AnimatePresence>
          {activeTab !== "build" && (
            <motion.div
              animate={{ x: 0, opacity: 1 }}
              className="z-10 w-80 shrink-0 overflow-y-auto border-white/10 border-l bg-[#000a16]/95 backdrop-blur-md"
              exit={{ x: 300, opacity: 0 }}
              initial={{ x: 300, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
            >
              {activeTab === "settings" && (
                <div className="space-y-8 p-6">
                  <div>
                    <h3 className="mb-6 font-medium text-lg text-white">
                      Page Settings
                    </h3>

                    <div className="space-y-4">
                      <div>
                        <label className="mb-1.5 block text-white/50 text-xs">
                          URL Slug
                        </label>
                        <div className="flex overflow-hidden rounded-lg border border-white/10 bg-white/5">
                          <span className="border-white/10 border-r bg-white/5 px-3 py-2 text-sm text-white/30">
                            biso.no
                          </span>
                          <input
                            className="flex-1 bg-transparent px-3 py-2 text-sm text-white outline-none focus:bg-white/5"
                            defaultValue={page.slug}
                            type="text"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="mb-1.5 block text-white/50 text-xs">
                          SEO Meta Title
                        </label>
                        <input
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-[#3DA9E0]/50"
                          defaultValue={page.title}
                          type="text"
                        />
                      </div>

                      <div>
                        <label className="mb-1.5 block text-white/50 text-xs">
                          SEO Description
                        </label>
                        <textarea
                          className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-[#3DA9E0]/50"
                          defaultValue="A brief description for search engines."
                          rows={3}
                        />
                      </div>

                      <div>
                        <label className="mb-1.5 block text-white/50 text-xs">
                          Social Image (OG)
                        </label>
                        <div className="group relative aspect-video cursor-pointer overflow-hidden rounded-lg border border-white/10">
                          <img
                            className="h-full w-full object-cover opacity-70 transition-opacity group-hover:opacity-40"
                            src={page.image}
                          />
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                            <span className="rounded-md bg-black/60 px-3 py-1.5 font-medium text-sm">
                              Change Image
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border-white/10 border-t pt-6">
                    <button className="w-full rounded-lg border border-red-500/30 py-2.5 font-medium text-red-400 text-sm transition-colors hover:bg-red-500/10">
                      Move to Trash
                    </button>
                  </div>
                </div>
              )}

              {activeTab === "history" && (
                <div className="p-6">
                  <h3 className="mb-6 font-medium text-lg text-white">
                    Revision History
                  </h3>
                  <div className="relative space-y-6 before:absolute before:inset-0 before:ml-[11px] before:h-full before:w-0.5 before:-translate-x-px before:bg-linear-to-b before:from-transparent before:via-white/10 before:to-transparent md:before:mx-auto md:before:translate-x-0">
                    {/* Mock timeline items */}
                    <div className="group is-active relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse">
                      <div className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#001731] text-[#3DA9E0] shadow-[0_0_10px_#3DA9E0] md:order-1 md:group-even:translate-x-1/2 md:group-odd:-translate-x-1/2">
                        <div className="h-2 w-2 rounded-full bg-[#3DA9E0]" />
                      </div>
                      <div className="w-[calc(100%-2.5rem)] rounded-xl border border-[#3DA9E0]/30 bg-[#3DA9E0]/5 p-3 md:w-[calc(50%-1.5rem)]">
                        <p className="font-medium text-sm text-white">
                          Current Version
                        </p>
                        <p className="mt-1 text-white/50 text-xs">
                          Autosaved just now
                        </p>
                      </div>
                    </div>

                    <div className="group relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse">
                      <div className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#000a16] md:order-1 md:group-even:translate-x-1/2 md:group-odd:-translate-x-1/2" />
                      <div className="w-[calc(100%-2.5rem)] cursor-pointer rounded-xl border border-white/5 p-3 transition-colors hover:border-white/10 hover:bg-white/5 md:w-[calc(50%-1.5rem)]">
                        <p className="font-medium text-sm text-white/80">
                          Published
                        </p>
                        <p className="mt-1 text-white/50 text-xs">
                          by Admin • 2h ago
                        </p>
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
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-100 flex items-center justify-center bg-[#000a16]/80 p-4 backdrop-blur-md"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
          >
            <motion.div
              animate={{ scale: 1, opacity: 1 }}
              className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#001731] p-8 shadow-2xl"
              exit={{ scale: 0.95, opacity: 0 }}
              initial={{ scale: 0.95, opacity: 0 }}
            >
              <div className="absolute top-0 right-0 h-64 w-64 translate-x-1/2 -translate-y-1/2 rounded-full bg-[#3DA9E0]/20 blur-[80px]" />

              <button
                className="absolute top-6 right-6 text-white/50 hover:text-white"
                onClick={() => setShowPublishModal(false)}
              >
                <X size={20} />
              </button>

              <h2 className="relative z-10 mb-2 font-light text-3xl text-white">
                Ready to publish?
              </h2>
              <p className="relative z-10 mb-8 text-white/60">
                This will make your changes live immediately to all visitors on
                biso.no.
              </p>

              <div className="relative z-10 mb-8 space-y-4">
                <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 p-4">
                  <span className="text-sm text-white/70">Status</span>
                  <span className="font-medium text-sm text-white">
                    Live Public
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 p-4">
                  <span className="text-sm text-white/70">Localization</span>
                  <span className="font-medium text-sm text-white">
                    English (Primary)
                  </span>
                </div>
              </div>

              <div className="relative z-10 flex gap-3">
                <button
                  className="flex-1 rounded-xl border border-white/10 py-3 font-medium text-white transition-colors hover:bg-white/5"
                  onClick={() => setShowPublishModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="flex-1 rounded-xl bg-[#3DA9E0] py-3 font-bold text-[#001731] shadow-[0_0_20px_rgba(61,169,224,0.4)] transition-all hover:shadow-[0_0_30px_rgba(61,169,224,0.6)]"
                  onClick={() => {
                    setShowPublishModal(false);
                    // Add success toast logic here
                  }}
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

function BlockCategory({
  title,
  items,
}: {
  title: string;
  items: { icon: any; name: string; desc: string }[];
}) {
  return (
    <div className="mb-6">
      <h4 className="mb-3 px-2 font-semibold text-[11px] text-white/60 uppercase">
        {title}
      </h4>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div
            className="group flex cursor-grab items-start gap-3 rounded-xl border border-transparent p-3 transition-all hover:border-white/5 hover:bg-white/10 active:cursor-grabbing"
            draggable
            key={i}
          >
            <div className="rounded-lg bg-white/5 p-2 text-white/50 transition-colors group-hover:bg-[#3DA9E0]/10 group-hover:text-[#3DA9E0]">
              <item.icon size={18} />
            </div>
            <div>
              <p className="font-medium text-sm text-white/90 transition-colors group-hover:text-white">
                {item.name}
              </p>
              <p className="mt-0.5 text-[11px] text-white/40">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
