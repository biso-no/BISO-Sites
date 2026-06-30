"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { TourRenderer } from "./components/tour-renderer";
import { TourContext, type TourContextValue } from "./tour-context";
import type {
  TourDefinition,
  TourEvent,
  TourLabels,
  TourPersistenceAdapter,
  TourProgressRecord,
  TourStepRenderContext,
} from "./types";

const DEFAULT_LABELS: TourLabels = {
  skip: "Skip",
  back: "Back",
  next: "Next",
  finish: "Finish",
  close: "Close tour",
  progress: (current, total) => `${current} of ${total}`,
};

interface TourAutoStart {
  /** Host-resolved eligibility (e.g. "is HR and on the right route"). */
  eligible: boolean;
  tourId: string;
}

interface TourProviderProps {
  /** Auto-offer a tour on mount when eligible and not already completed/dismissed. */
  autoStart?: TourAutoStart | null;
  children: ReactNode;
  /** Override any control labels (localization). */
  labels?: Partial<TourLabels>;
  /**
   * Injected router push for multi-page tours, e.g. `(p) => router.push(p)`.
   * Called on entry to any step that declares a `route` not matching the
   * current path. Kept out of the package so it stays framework-agnostic.
   */
  navigate?: (path: string) => void;
  /** Injected analytics sink, e.g. `(e) => window.umami?.track(e.name, e.data)`. */
  onEvent?: (event: TourEvent) => void;
  /** Injected progress persistence. Omit for an ephemeral (no-save) provider. */
  persistence?: TourPersistenceAdapter;
  /** Tours available in this app, keyed by tour id. */
  registry: Record<string, TourDefinition>;
  /** Render a fully custom (on-brand) step card instead of the default one. */
  renderStepCard?: (context: TourStepRenderContext) => ReactNode;
  /** Resolves step `title`/`body` keys (e.g. a next-intl `t`). */
  translate?: (key: string) => string;
}

export function TourProvider({
  registry,
  persistence,
  onEvent,
  translate,
  labels,
  navigate,
  renderStepCard,
  autoStart,
  children,
}: TourProviderProps) {
  const [activeTourId, setActiveTourId] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [progress, setProgress] = useState<Record<string, TourProgressRecord>>(
    {}
  );
  const [loaded, setLoaded] = useState(false);
  const autoStartedRef = useRef(false);

  const mergedLabels = useMemo<TourLabels>(
    () => ({ ...DEFAULT_LABELS, ...labels }),
    [labels]
  );

  const emit = useCallback(
    (event: TourEvent) => {
      onEvent?.(event);
    },
    [onEvent]
  );

  const persist = useCallback(
    (record: TourProgressRecord) => {
      setProgress((prev) => ({ ...prev, [record.tourId]: record }));
      if (persistence) {
        persistence.save(record).catch(() => undefined);
      }
    },
    [persistence]
  );

  useEffect(() => {
    if (!persistence) {
      setLoaded(true);
      return;
    }
    let cancelled = false;
    persistence
      .load()
      .then((records) => {
        if (cancelled) {
          return;
        }
        const map: Record<string, TourProgressRecord> = {};
        for (const record of records) {
          map[record.tourId] = record;
        }
        setProgress(map);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) {
          setLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [persistence]);

  const activeTour = activeTourId ? (registry[activeTourId] ?? null) : null;
  const totalSteps = activeTour?.steps.length ?? 0;
  const currentStep = activeTour?.steps[stepIndex] ?? null;

  const start = useCallback(
    (tourId: string) => {
      const tour = registry[tourId];
      if (!tour) {
        return;
      }
      const existing = progress[tourId];
      const resumeIndex =
        existing &&
        existing.version === tour.version &&
        existing.status === "in_progress"
          ? Math.min(existing.stepIndex, tour.steps.length - 1)
          : 0;
      setActiveTourId(tourId);
      setStepIndex(resumeIndex);
      persist({
        tourId,
        status: "in_progress",
        stepIndex: resumeIndex,
        version: tour.version,
      });
      emit({
        name: "tour_start",
        data: { tourId, version: tour.version, step: resumeIndex },
      });
      emit({ name: "tour_step_view", data: { tourId, step: resumeIndex } });
    },
    [registry, progress, persist, emit]
  );

  const next = useCallback(() => {
    if (!activeTour) {
      return;
    }
    const lastIndex = activeTour.steps.length - 1;
    if (stepIndex >= lastIndex) {
      return;
    }
    const nextIndex = stepIndex + 1;
    setStepIndex(nextIndex);
    persist({
      tourId: activeTour.id,
      status: "in_progress",
      stepIndex: nextIndex,
      version: activeTour.version,
    });
    emit({
      name: "tour_step_view",
      data: { tourId: activeTour.id, step: nextIndex },
    });
  }, [activeTour, stepIndex, persist, emit]);

  const back = useCallback(() => {
    if (!activeTour || stepIndex <= 0) {
      return;
    }
    const prevIndex = stepIndex - 1;
    setStepIndex(prevIndex);
    persist({
      tourId: activeTour.id,
      status: "in_progress",
      stepIndex: prevIndex,
      version: activeTour.version,
    });
    emit({
      name: "tour_step_view",
      data: { tourId: activeTour.id, step: prevIndex },
    });
  }, [activeTour, stepIndex, persist, emit]);

  const finish = useCallback(() => {
    if (!activeTour) {
      return;
    }
    persist({
      tourId: activeTour.id,
      status: "completed",
      stepIndex: activeTour.steps.length - 1,
      version: activeTour.version,
    });
    emit({
      name: "tour_complete",
      data: { tourId: activeTour.id, version: activeTour.version },
    });
    setActiveTourId(null);
    setStepIndex(0);
  }, [activeTour, persist, emit]);

  const skip = useCallback(() => {
    if (!activeTour) {
      return;
    }
    persist({
      tourId: activeTour.id,
      status: "dismissed",
      stepIndex,
      version: activeTour.version,
    });
    emit({
      name: "tour_dismiss",
      data: { tourId: activeTour.id, step: stepIndex },
    });
    setActiveTourId(null);
    setStepIndex(0);
  }, [activeTour, stepIndex, persist, emit]);

  useEffect(() => {
    if (!(loaded && autoStart?.eligible) || autoStartedRef.current) {
      return;
    }
    const tour = registry[autoStart.tourId];
    if (!tour) {
      return;
    }
    const record = progress[autoStart.tourId];
    const alreadyResolved =
      record &&
      record.version === tour.version &&
      (record.status === "completed" || record.status === "dismissed");
    autoStartedRef.current = true;
    if (!alreadyResolved) {
      start(autoStart.tourId);
    }
  }, [loaded, autoStart, registry, progress, start]);

  const availableTours = useMemo(() => Object.values(registry), [registry]);

  const value = useMemo<TourContextValue>(
    () => ({
      activeTour,
      currentStep,
      stepIndex,
      totalSteps,
      start,
      next,
      back,
      skip,
      finish,
      availableTours,
    }),
    [
      activeTour,
      currentStep,
      stepIndex,
      totalSteps,
      start,
      next,
      back,
      skip,
      finish,
      availableTours,
    ]
  );

  return (
    <TourContext.Provider value={value}>
      {children}
      <TourRenderer
        labels={mergedLabels}
        navigate={navigate}
        renderStepCard={renderStepCard}
        translate={translate}
      />
    </TourContext.Provider>
  );
}
