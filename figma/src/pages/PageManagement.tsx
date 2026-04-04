import {
  Filter,
  Globe,
  Grid,
  List as ListIcon,
  MoreHorizontal,
  Plus,
  Search,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Link } from "react-router";
import { MOCK_PAGES } from "../data";

export function PageManagement() {
  const [view, setView] = useState<"grid" | "list">("grid");
  const [search, setSearch] = useState("");

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 pb-12"
      initial={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.5 }}
    >
      <header className="flex flex-col justify-between gap-6 pt-4 md:flex-row md:items-end">
        <div>
          <h1 className="font-light text-4xl text-white tracking-tight md:text-5xl">
            Pages
          </h1>
          <p className="mt-2 text-lg text-white/50">
            Manage, create, and publish site content.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex rounded-xl border border-white/10 bg-white/5 p-1 backdrop-blur-sm">
            <button
              className={`rounded-lg p-2 transition-all ${view === "grid" ? "bg-white/10 text-white shadow-sm" : "text-white/40 hover:text-white/80"}`}
              onClick={() => setView("grid")}
            >
              <Grid size={18} />
            </button>
            <button
              className={`rounded-lg p-2 transition-all ${view === "list" ? "bg-white/10 text-white shadow-sm" : "text-white/40 hover:text-white/80"}`}
              onClick={() => setView("list")}
            >
              <ListIcon size={18} />
            </button>
          </div>
          <Link
            className="flex items-center gap-2 rounded-full bg-[#3DA9E0] px-6 py-3 font-semibold text-[#001731] shadow-[0_0_20px_rgba(61,169,224,0.3)] transition-all hover:shadow-[0_0_30px_rgba(61,169,224,0.5)]"
            to="/editor/new"
          >
            <Plus size={18} />
            <span>Create Page</span>
          </Link>
        </div>
      </header>

      {/* Toolbar */}
      <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
        <div className="relative w-full md:w-96">
          <Search
            className="absolute top-1/2 left-4 -translate-y-1/2 text-white/40"
            size={18}
          />
          <input
            className="w-full rounded-2xl border border-white/10 bg-white/5 py-3 pr-4 pl-12 text-white outline-none backdrop-blur-sm transition-colors placeholder:text-white/40 focus:border-[#3DA9E0]"
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search pages..."
            type="text"
            value={search}
          />
        </div>
        <div className="hide-scrollbar flex w-full gap-3 overflow-x-auto pb-2 md:w-auto md:pb-0">
          {["All", "Department Pages", "Published", "Draft", "Review"].map(
            (status) => (
              <button
                className={`whitespace-nowrap rounded-full border px-5 py-2 text-sm transition-all ${status === "Department Pages" ? "border-[#3DA9E0]/30 bg-[#3DA9E0]/10 text-[#3DA9E0]" : "border-white/10 text-white/60 hover:bg-white/5 hover:text-white"}`}
                key={status}
              >
                {status}
              </button>
            )
          )}
          <button className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition-all hover:bg-white/10">
            <Filter size={14} /> Filters
          </button>
        </div>
      </div>

      {/* Grid View */}
      <AnimatePresence mode="wait">
        {view === "grid" ? (
          <motion.div
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            key="grid"
          >
            {MOCK_PAGES.map((page, i) => (
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                className="group flex flex-col overflow-hidden rounded-3xl border border-white/5 bg-white/2 transition-all duration-300 hover:bg-white/4"
                initial={{ opacity: 0, y: 20 }}
                key={page.id}
                transition={{ delay: i * 0.05 }}
              >
                <Link
                  className="relative block aspect-4/3 overflow-hidden bg-[#001731]"
                  to={`/editor/${page.id}`}
                >
                  <img
                    alt={page.title}
                    className="h-full w-full object-cover opacity-80 transition-transform duration-700 group-hover:scale-105 group-hover:opacity-100"
                    src={page.image}
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-[#000a16] via-transparent to-transparent opacity-80" />

                  <div className="absolute top-4 left-4">
                    <StatusBadge status={page.status} />
                  </div>

                  <div className="absolute top-4 right-4 cursor-pointer rounded-lg border border-white/10 bg-[#000a16]/80 p-2 opacity-0 backdrop-blur-md transition-opacity hover:bg-white/10 group-hover:opacity-100">
                    <MoreHorizontal className="text-white" size={16} />
                  </div>
                </Link>

                <div className="flex flex-1 flex-col p-5">
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div>
                      <Link
                        className="line-clamp-1 font-medium text-lg text-white transition-colors hover:text-[#3DA9E0]"
                        to={`/editor/${page.id}`}
                      >
                        {page.title}
                      </Link>
                      <p className="mt-1 truncate font-mono text-sm text-white/40">
                        {page.slug}
                      </p>
                    </div>
                  </div>

                  <div className="mt-auto flex items-center justify-between border-white/5 border-t pt-4 text-white/40 text-xs">
                    <span className="flex items-center gap-1.5">
                      <Globe size={12} /> EN, NO
                    </span>
                    <span>Edited {page.lastEdited}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <motion.div
            animate={{ opacity: 1 }}
            className="overflow-hidden rounded-3xl border border-white/10 bg-white/2 backdrop-blur-sm"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            key="list"
          >
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-white/10 border-b">
                  <th className="px-6 py-4 font-medium text-sm text-white/40">
                    Page Title
                  </th>
                  <th className="px-6 py-4 font-medium text-sm text-white/40">
                    Status
                  </th>
                  <th className="hidden px-6 py-4 font-medium text-sm text-white/40 md:table-cell">
                    Author
                  </th>
                  <th className="hidden px-6 py-4 font-medium text-sm text-white/40 lg:table-cell">
                    Last Edited
                  </th>
                  <th className="px-6 py-4 text-right font-medium text-sm text-white/40">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {MOCK_PAGES.map((page, i) => (
                  <tr
                    className="group border-white/5 border-b transition-colors hover:bg-white/5"
                    key={page.id}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="hidden h-12 w-12 shrink-0 overflow-hidden rounded-lg sm:block">
                          <img
                            alt={page.title}
                            className="h-full w-full object-cover opacity-80"
                            src={page.image}
                          />
                        </div>
                        <div>
                          <Link
                            className="block font-medium text-white transition-colors hover:text-[#3DA9E0]"
                            to={`/editor/${page.id}`}
                          >
                            {page.title}
                          </Link>
                          <span className="font-mono text-white/40 text-xs">
                            {page.slug}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={page.status} />
                    </td>
                    <td className="hidden px-6 py-4 text-sm text-white/70 md:table-cell">
                      {page.author}
                    </td>
                    <td className="hidden px-6 py-4 text-sm text-white/50 lg:table-cell">
                      {page.lastEdited}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="rounded-lg p-2 text-white/40 transition-all hover:bg-white/10 hover:text-white">
                        <MoreHorizontal size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        )}
      </AnimatePresence>
      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </motion.div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles =
    {
      published:
        "bg-[#3DA9E0]/10 text-[#3DA9E0] border-[#3DA9E0]/30 shadow-[0_0_10px_rgba(61,169,224,0.2)]",
      review: "bg-amber-400/10 text-amber-400 border-amber-400/30",
      draft: "bg-white/10 text-white/70 border-white/20",
    }[status] || "bg-white/10 text-white border-white/20";

  return (
    <span
      className={`flex w-fit items-center gap-1.5 rounded-full border px-3 py-1 font-semibold text-[11px] uppercase tracking-wider backdrop-blur-md ${styles}`}
    >
      {status === "published" && (
        <span className="h-1.5 w-1.5 rounded-full bg-[#3DA9E0] shadow-[0_0_5px_#3DA9E0]" />
      )}
      {status === "review" && (
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
      )}
      {status === "draft" && (
        <span className="h-1.5 w-1.5 rounded-full bg-white/50" />
      )}
      {status}
    </span>
  );
}
