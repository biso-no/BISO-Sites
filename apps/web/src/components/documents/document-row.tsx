"use client";

import type { Documents } from "@repo/api/types/appwrite";
import {
  BookOpen,
  Briefcase,
  Building2,
  Download,
  Eye,
  MessageSquare,
  Scale,
  Shield,
} from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";

const CATEGORY_CONFIG: Record<
  string,
  {
    label: string;
    icon: React.ComponentType<{
      className?: string;
      style?: React.CSSProperties;
    }>;
    gradient: string;
  }
> = {
  "national-statutes": {
    label: "National Statutes",
    icon: Scale,
    gradient: "linear-gradient(135deg, #06b6d4, #3b82f6)",
  },
  "campus-bylaws": {
    label: "Campus Bylaws",
    icon: Building2,
    gradient: "linear-gradient(135deg, #3b82f6, #6366f1)",
  },
  "code-of-conduct": {
    label: "Code of Conduct",
    icon: Shield,
    gradient: "linear-gradient(135deg, #6366f1, #a855f7)",
  },
  "business-regulations": {
    label: "Business Regulations",
    icon: Briefcase,
    gradient: "linear-gradient(135deg, #a855f7, #ec4899)",
  },
  "communication-guidelines": {
    label: "Communication Guidelines",
    icon: MessageSquare,
    gradient: "linear-gradient(135deg, #ec4899, #06b6d4)",
  },
};

function formatBytes(bytes: number | null): string {
  if (!bytes) {
    return "";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface DocumentRowProps {
  doc: Documents;
  index: number;
}

export function DocumentRow({ doc, index }: DocumentRowProps) {
  const [isHovered, setIsHovered] = useState(false);
  const config = CATEGORY_CONFIG[doc.category];
  const Icon = config?.icon ?? BookOpen;

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="group relative"
      initial={{ opacity: 0, y: 20 }}
      onHoverEnd={() => setIsHovered(false)}
      onHoverStart={() => setIsHovered(true)}
      transition={{ duration: 0.5, delay: index * 0.05 }}
    >
      <div
        className="relative overflow-hidden rounded-2xl p-6 transition-all duration-300"
        style={{
          background: isHovered
            ? "rgba(255,255,255,0.07)"
            : "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          backdropFilter: "blur(12px)",
        }}
      >
        {/* Hover gradient overlay */}
        <div
          className="pointer-events-none absolute inset-0 rounded-2xl transition-opacity duration-300"
          style={{
            background: config?.gradient,
            opacity: isHovered ? 0.07 : 0,
          }}
        />

        <div className="relative flex flex-col gap-6 md:flex-row md:items-center">
          {/* Category icon */}
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl shadow-lg"
            style={{ background: config?.gradient }}
          >
            <Icon className="h-8 w-8 text-white" />
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-start gap-3">
              <h3
                className="font-semibold text-xl transition-colors duration-300"
                style={{ color: isHovered ? "#3DA9E0" : "#fff" }}
              >
                {doc.title}
              </h3>
              {doc.scope === "campus" && doc.campus_id && (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-medium text-xs"
                  style={{
                    background: "rgba(61,169,224,0.15)",
                    border: "1px solid rgba(61,169,224,0.30)",
                    color: "#3DA9E0",
                  }}
                >
                  <Building2 className="h-3 w-3" />
                  Campus
                </span>
              )}
            </div>

            {doc.description && (
              <p
                className="mb-3 leading-relaxed"
                style={{ color: "rgba(255,255,255,0.60)" }}
              >
                {doc.description}
              </p>
            )}

            <div
              className="flex flex-wrap items-center gap-3 text-sm"
              style={{ color: "rgba(255,255,255,0.40)" }}
            >
              {doc.version && <span>{doc.version}</span>}
              {doc.version && <span>·</span>}
              {doc.file_size ? (
                <>
                  <span>{formatBytes(doc.file_size)}</span>
                  <span>·</span>
                </>
              ) : null}
              <span>{config?.label ?? doc.category}</span>
              <span>·</span>
              <span>
                Updated{" "}
                {new Date(doc.$updatedAt).toLocaleDateString("en-GB", {
                  year: "numeric",
                  month: "long",
                })}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex shrink-0 items-center gap-3">
            <motion.a
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm transition-all duration-300"
              href={doc.sharepoint_web_url}
              rel="noopener noreferrer"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.10)",
                color: "rgba(255,255,255,0.80)",
              }}
              target="_blank"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Eye className="h-4 w-4" />
              <span className="hidden sm:inline">View</span>
            </motion.a>

            <motion.a
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm shadow-lg transition-all duration-300"
              download
              href={`/api/documents/${doc.$id}/download`}
              style={{
                background: "linear-gradient(135deg, #3DA9E0, #2d8bc0)",
                color: "#fff",
                boxShadow: "0 4px 15px rgba(61,169,224,0.30)",
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Download</span>
            </motion.a>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
