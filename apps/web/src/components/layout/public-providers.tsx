"use client";
import "@assistant-ui/styles/index.css";
import "@assistant-ui/styles/markdown.css";
import { AssistantRuntimeProvider, makeAssistantToolUI } from "@assistant-ui/react";
import { AssistantChatTransport } from "@assistant-ui/react-ai-sdk";
import { useChatRuntime } from "@assistant-ui/react-ai-sdk";
import { CampusProvider } from "../context/campus";
import { CalendarDays, FileText, Globe, Loader2, Newspaper, Search, UserCircle2, BriefcaseBusiness } from "lucide-react";
import React, { useState } from "react";
import { summarizeSharePointResults, summarizeSiteResults } from "@/components/ai/tool-utils";

export const PublicProviders = ({ children }: { children: React.ReactNode }) => {
  const runtime = useChatRuntime({
    transport: new AssistantChatTransport({
      api: "/api/public-assistant",
    }),
  });
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <PublicAssistantContext />
      <CampusProvider>
        {children}
      </CampusProvider>
    </AssistantRuntimeProvider>
  );
};

function PublicAssistantContext() {
  // Tool UI: SharePoint RAG search
  makeAssistantToolUI<
    { query: string; k?: number; filter?: Record<string, any> },
    { results: Array<{ title: string; text: string; site?: string; lastModified?: string; documentViewerUrl?: string }>; totalResults: number; message?: string }
  >({
    toolName: "searchSharePoint",
    render: ({ status, result }) => {
      const [show, setShow] = useState(false);
      // Compact, generative-style status line while running
      if (status.type === "running") {
        return (
          <div className="my-1 inline-flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            <span>Searching documents…</span>
          </div>
        );
      }
      if (status.type === "incomplete" && status.reason === "error") {
        return <div className="my-1 text-xs text-red-600">Failed to search documents.</div>;
      }
      if (!result) return null;

      const items = (result.results || []).slice(0, 4);

      // Summary line + tiny chips for top results
      return (
        <div className="my-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <FileText className="h-3.5 w-3.5 text-primary" />
            <span>Found {result.totalResults ?? items.length} document{(result.totalResults ?? items.length) === 1 ? '' : 's'}</span>
          </span>
          {result.message ? (
            <span className="ml-2">• {result.message}</span>
          ) : null}
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {items.map((r, idx) => (
              <a
                key={idx}
                href={r.documentViewerUrl}
                target="_blank"
                rel="noreferrer"
                className="max-w-[220px] truncate rounded-full bg-primary/5 px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/10"
                title={r.title || 'Document'}
              >
                {r.title || 'Document'}
              </a>
            ))}
          </div>
          <button
            type="button"
            className="mt-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-primary hover:underline"
            onClick={() => setShow((s) => !s)}
          >
            {show ? 'Hide details' : 'Show details'}
          </button>
          {show ? (
            <ul className="mt-1 flex flex-col gap-1.5">
              {summarizeSharePointResults(result, 2).map((s, i) => (
                <li key={i} className="rounded-md bg-primary/5 p-2">
                  <div className="mb-0.5 flex items-center gap-1">
                    <Search className="h-3 w-3 text-primary/80" />
                    {s.href ? (
                      <a href={s.href} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">
                        {s.title}
                      </a>
                    ) : (
                      <span className="font-medium">{s.title}</span>
                    )}
                  </div>
                  {s.snippet ? (<p className="text-[11.5px] text-muted-foreground">{s.snippet}</p>) : null}
                  <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                    {s.site ? (<span className="inline-flex items-center gap-1"><Globe className="h-3 w-3" />{s.site}</span>) : null}
                    {s.lastModified ? (<span>Updated {new Date(s.lastModified).toLocaleDateString()}</span>) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      );
    },
  });

  // Tool UI: Public site content search (jobs, events, news, units)
  makeAssistantToolUI<
    { query: string; indices?: Array<"jobs"|"events"|"news"|"units">; limit?: number; locale?: "en"|"no" },
    { results: Array<{ title: string; description?: string; href?: string; index?: string }>; totalResults: number; message?: string }
  >({
    toolName: "searchSiteContent",
    render: ({ status, result }) => {
      const [show, setShow] = useState(false);
      if (status.type === "running") {
        return (
          <div className="my-1 inline-flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            <span>Searching the site…</span>
          </div>
        );
      }
      if (status.type === "incomplete" && status.reason === "error") {
        return <div className="my-1 text-xs text-red-600">Failed to search the site.</div>;
      }
      if (!result) return null;

      const iconFor = (index?: string) => {
        switch (index) {
          case "events": return <CalendarDays className="h-3 w-3" />;
          case "jobs": return <BriefcaseBusiness className="h-3 w-3" />;
          case "news": return <Newspaper className="h-3 w-3" />;
          case "units": return <UserCircle2 className="h-3 w-3" />;
          default: return <Search className="h-3 w-3" />;
        }
      };

      const items = (result.results || []).slice(0, 5);
      return (
        <div className="my-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Globe className="h-3.5 w-3.5 text-primary" />
            <span>Found {result.totalResults ?? items.length} site result{(result.totalResults ?? items.length) === 1 ? '' : 's'}</span>
          </span>
          {result.message ? (
            <span className="ml-2">• {result.message}</span>
          ) : null}
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {items.map((r, idx) => (
              <a
                key={idx}
                href={r.href}
                className="max-w-[220px] truncate rounded-full bg-primary/5 px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/10"
                title={r.title}
              >
                <span className="mr-1 inline-flex items-center text-primary/70">{iconFor(r.index)}</span>
                {r.title}
              </a>
            ))}
          </div>
          <button
            type="button"
            className="mt-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-primary hover:underline"
            onClick={() => setShow((s) => !s)}
          >
            {show ? 'Hide details' : 'Show details'}
          </button>
          {show ? (
            <ul className="mt-1 flex flex-col gap-1.5">
              {summarizeSiteResults(result, 3).map((s, i) => (
                <li key={i} className="rounded-md bg-primary/5 p-2">
                  <div className="mb-0.5 flex items-center gap-1">
                    <span className="text-primary/80">{iconFor(s.index)}</span>
                    {s.href ? (
                      <a href={s.href} className="font-medium text-primary hover:underline">{s.title}</a>
                    ) : (
                      <span className="font-medium">{s.title}</span>
                    )}
                  </div>
                  {s.snippet ? (<p className="text-[11.5px] text-muted-foreground">{s.snippet}</p>) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      );
    }
  });

  return null;
}
