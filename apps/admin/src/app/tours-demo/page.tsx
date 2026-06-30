"use client";

/**
 * DEV-ONLY isolation demo for @repo/tours (Phase 2 review).
 *
 * Lives at the top level (outside the (portal) auth gate) so the tour overlay +
 * step card can be reviewed in isolation, against the admin design language,
 * without the full portal shell. Remove (or move behind auth) before merge — see
 * apps/admin/CLAUDE.md "any new top-level route segment must add its own auth".
 */

import { TourProvider } from "@repo/tours/provider";
import type {
  TourDefinition,
  TourEvent,
  TourPersistenceAdapter,
  TourProgressRecord,
} from "@repo/tours/types";
import { useTour } from "@repo/tours/use-tour";
import { Button } from "@repo/ui/components/ui/button";
import { Briefcase, Filter, Plus, RotateCcw } from "lucide-react";
import { useCallback, useRef, useState } from "react";

const ASYNC_DELAY_MS = 1500;
const LOG_LIMIT = 8;
const STORAGE_KEY = "biso-tours-demo-progress";

const DEMO_TOUR: TourDefinition = {
  id: "demo-walkthrough",
  version: 1,
  steps: [
    {
      id: "welcome",
      target: { type: "center" },
      title: "Welcome to the tour demo",
      body: "This is a centered step. Use Next/Back, the arrow keys, or Esc to dismiss. Your progress is saved to localStorage so you can test fresh vs. returning visits.",
    },
    {
      id: "nav",
      target: { type: "element", selector: '[data-tour="demo-nav-jobs"]' },
      title: "Anchored to the sidebar",
      body: "The card anchors to a real element and the rest of the page dims. The popover flips automatically near viewport edges.",
      placement: "right",
    },
    {
      id: "create",
      target: { type: "element", selector: '[data-tour="demo-create"]' },
      title: "Primary actions",
      body: "Steps point at concrete controls — here, a primary action button.",
      placement: "bottom",
    },
    {
      id: "pipeline",
      target: { type: "element", selector: '[data-tour="demo-pipeline"]' },
      title: "Scrolls into view",
      body: "This target sits far down the page. The tour scrolls it into view (respecting reduced-motion) before highlighting it.",
      placement: "top",
    },
    {
      id: "async",
      target: { type: "element", selector: '[data-tour="demo-async"]' },
      title: "Waits for async targets",
      body: 'Click "Load slow panel" before reaching this step and the tour waits for the element to mount. If it never appears, this step falls back to a centered card instead of crashing.',
      placement: "left",
    },
    {
      id: "missing",
      target: { type: "element", selector: '[data-tour="does-not-exist"]' },
      title: "Graceful fallback",
      body: "This step targets a selector that does not exist. After a short wait it renders centered rather than breaking the page.",
    },
    {
      id: "done",
      target: { type: "center" },
      title: "That's the tour",
      body: 'Finish records "completed"; Skip records "dismissed". Either way you won\'t be auto-prompted again. Use "Reset progress" to test a fresh visit.',
    },
  ],
};

function createLocalPersistence(): TourPersistenceAdapter {
  return {
    load() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return Promise.resolve(
          raw ? (JSON.parse(raw) as TourProgressRecord[]) : []
        );
      } catch {
        return Promise.resolve([]);
      }
    },
    save(record) {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const all: TourProgressRecord[] = raw ? JSON.parse(raw) : [];
        const filtered = all.filter((item) => item.tourId !== record.tourId);
        filtered.push(record);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
      } catch {
        // Best-effort; demo only.
      }
      return Promise.resolve();
    },
  };
}

const demoPersistence = createLocalPersistence();

interface LogEntry {
  id: number;
  text: string;
}

interface DemoSurfaceProps {
  log: LogEntry[];
  onLoadAsync: () => void;
  onReset: () => void;
  showAsync: boolean;
}

function DemoSurface({
  log,
  showAsync,
  onLoadAsync,
  onReset,
}: DemoSurfaceProps) {
  const { start, activeTour } = useTour();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-border border-b bg-background/80 px-6 py-4 backdrop-blur">
        <div className="mr-auto">
          <h1 className="font-semibold text-lg">
            @repo/tours — isolation demo
          </h1>
          <p className="text-muted-foreground text-sm">
            {activeTour ? "Tour running…" : "Idle"}
          </p>
        </div>
        <Button onClick={() => start(DEMO_TOUR.id)}>Start tour</Button>
        <Button onClick={onLoadAsync} variant="outline">
          Load slow panel
        </Button>
        <Button className="gap-1.5" onClick={onReset} variant="ghost">
          <RotateCcw aria-hidden="true" className="size-4" />
          Reset progress
        </Button>
      </header>

      <div className="mx-auto grid max-w-5xl grid-cols-[200px_1fr] gap-6 px-6 py-8">
        <aside className="space-y-1">
          <p className="px-2 pb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
            Navigation
          </p>
          <span
            className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 font-medium text-sm"
            data-tour="demo-nav-jobs"
          >
            <Briefcase aria-hidden="true" className="size-4" />
            Recruitment
          </span>
          <span className="flex items-center gap-2 rounded-md px-3 py-2 text-muted-foreground text-sm">
            <Filter aria-hidden="true" className="size-4" />
            Applications
          </span>
        </aside>

        <main className="space-y-6">
          <section className="flex items-center justify-between rounded-xl border border-border p-5">
            <div>
              <h2 className="font-semibold">Vacancies</h2>
              <p className="text-muted-foreground text-sm">
                Manage open positions across campuses.
              </p>
            </div>
            <Button className="gap-1.5" data-tour="demo-create">
              <Plus aria-hidden="true" className="size-4" />
              Create vacancy
            </Button>
          </section>

          {/* Spacer forces the next target off-screen to demo scroll-into-view. */}
          <div className="h-[70vh] rounded-xl border border-border border-dashed bg-muted/30" />

          <section
            className="rounded-xl border border-border p-5"
            data-tour="demo-pipeline"
          >
            <h2 className="font-semibold">Review pipeline</h2>
            <p className="text-muted-foreground text-sm">
              Candidates move through stages here.
            </p>
          </section>

          {showAsync ? (
            <section
              className="rounded-xl border border-brand-border bg-brand-muted/40 p-5"
              data-tour="demo-async"
            >
              <h2 className="font-semibold">Slow-loaded panel</h2>
              <p className="text-muted-foreground text-sm">
                Mounted after a delay — the tour waited for it.
              </p>
            </section>
          ) : null}

          <section className="rounded-xl border border-border p-5">
            <h2 className="mb-2 font-semibold text-sm">Analytics events</h2>
            {log.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No events yet. Start the tour to see emitted events (these are
                forwarded to <code>window.umami?.track</code>).
              </p>
            ) : (
              <ul className="space-y-1">
                {log.map((entry) => (
                  <li
                    className="font-mono text-muted-foreground text-xs"
                    key={entry.id}
                  >
                    {entry.text}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

export default function ToursDemoPage() {
  const [log, setLog] = useState<LogEntry[]>([]);
  const [showAsync, setShowAsync] = useState(false);
  const idRef = useRef(0);

  const handleEvent = useCallback((event: TourEvent) => {
    idRef.current += 1;
    const id = idRef.current;
    setLog((prev) =>
      [
        { id, text: `${event.name} · ${JSON.stringify(event.data)}` },
        ...prev,
      ].slice(0, LOG_LIMIT)
    );
    (
      window as unknown as {
        umami?: {
          track: (name: string, data?: Record<string, unknown>) => void;
        };
      }
    ).umami?.track(event.name, event.data);
  }, []);

  const handleLoadAsync = useCallback(() => {
    setShowAsync(false);
    window.setTimeout(() => setShowAsync(true), ASYNC_DELAY_MS);
  }, []);

  const handleReset = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    window.location.reload();
  }, []);

  return (
    <TourProvider
      onEvent={handleEvent}
      persistence={demoPersistence}
      registry={{ [DEMO_TOUR.id]: DEMO_TOUR }}
    >
      <DemoSurface
        log={log}
        onLoadAsync={handleLoadAsync}
        onReset={handleReset}
        showAsync={showAsync}
      />
    </TourProvider>
  );
}
