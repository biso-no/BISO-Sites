"use client";

import type { Documents } from "@repo/api/types/appwrite";
import {
  BookOpen,
  Briefcase,
  Building2,
  FileText,
  MessageSquare,
  Scale,
  Search,
  Shield,
} from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { DocumentRow } from "./document-row";

const CATEGORIES = [
  { key: "all", label: "All Documents", icon: null },
  { key: "national-statutes", label: "National Statutes", icon: Scale },
  { key: "campus-bylaws", label: "Campus Bylaws", icon: Building2 },
  { key: "code-of-conduct", label: "Code of Conduct", icon: Shield },
  { key: "business-regulations", label: "Business Regulations", icon: Briefcase },
  { key: "communication-guidelines", label: "Communication Guidelines", icon: MessageSquare },
];

interface DocumentsListClientProps {
  documents: Documents[];
}

export function DocumentsListClient({ documents }: DocumentsListClientProps) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");

  const filtered = documents.filter((doc) => {
    const matchesCategory =
      activeCategory === "all" || doc.category === activeCategory;
    const query = search.trim().toLowerCase();
    const matchesSearch =
      !query ||
      doc.title.toLowerCase().includes(query) ||
      (doc.description ?? "").toLowerCase().includes(query);
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="mx-auto max-w-7xl px-6 pb-20">
      {/* Search */}
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="mb-12"
        initial={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.6, delay: 0.1 }}
      >
        <div className="relative mx-auto max-w-2xl">
          <Search
            className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2"
            style={{ color: "rgba(255,255,255,0.40)" }}
          />
          <input
            className="w-full rounded-2xl py-4 pl-12 pr-4 text-white outline-none transition-all"
            onChange={(e) => setSearch(e.target.value)}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "rgba(61,169,224,0.60)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "rgba(61,169,224,0.25)";
            }}
            placeholder="Search documents…"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(61,169,224,0.25)",
              backdropFilter: "blur(12px)",
            }}
            type="text"
            value={search}
          />
        </div>
      </motion.div>

      {/* Category filter */}
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="mb-12"
        initial={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <div className="flex flex-wrap justify-center gap-3">
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.key;
            const Icon = cat.icon;
            return (
              <motion.button
                className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-all duration-300"
                key={cat.key}
                onClick={() => setActiveCategory(cat.key)}
                style={
                  isActive
                    ? {
                        background: "linear-gradient(135deg, #3DA9E0, #2d8bc0)",
                        color: "#fff",
                        boxShadow: "0 4px 20px rgba(61,169,224,0.40)",
                      }
                    : {
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        color: "rgba(255,255,255,0.70)",
                      }
                }
                type="button"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {Icon && <Icon className="h-4 w-4" />}
                {cat.label}
              </motion.button>
            );
          })}
        </div>
      </motion.div>

      {/* Document list */}
      <motion.div
        animate={{ opacity: 1 }}
        className="space-y-4"
        initial={{ opacity: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
      >
        {filtered.length === 0 ? (
          <div className="py-20 text-center">
            <FileText
              className="mx-auto mb-4 h-16 w-16"
              style={{ color: "rgba(255,255,255,0.15)" }}
            />
            <p className="text-lg" style={{ color: "rgba(255,255,255,0.40)" }}>
              No documents found matching your search.
            </p>
          </div>
        ) : (
          filtered.map((doc, index) => (
            <DocumentRow doc={doc} index={index} key={doc.$id} />
          ))
        )}
      </motion.div>

      {/* Info banner */}
      {filtered.length > 0 && (
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="mt-16 rounded-2xl p-8"
          initial={{ opacity: 0, y: 20 }}
          style={{
            background: "linear-gradient(135deg, rgba(61,169,224,0.08) 0%, transparent 100%)",
            border: "1px solid rgba(61,169,224,0.25)",
            backdropFilter: "blur(12px)",
          }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          <div className="flex items-start gap-4">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
              style={{ background: "rgba(61,169,224,0.15)" }}
            >
              <BookOpen className="h-6 w-6" style={{ color: "#3DA9E0" }} />
            </div>
            <div>
              <h3 className="mb-2 text-xl font-semibold text-white">
                Document Updates
              </h3>
              <p className="leading-relaxed" style={{ color: "rgba(255,255,255,0.60)" }}>
                These documents are regularly reviewed and updated to ensure they
                reflect current policies and regulations. All documents are
                synchronized directly from our SharePoint repository to ensure you
                always have access to the latest versions.
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
