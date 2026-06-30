"use client";

import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@repo/ui/components/ui/popover";
import { type ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { resolveTargetElement } from "../lib/resolve-target";
import { usePrefersReducedMotion } from "../lib/use-prefers-reduced-motion";
import { useTargetRect } from "../lib/use-target-rect";
import type {
  TourLabels,
  TourPlacement,
  TourStepRenderContext,
} from "../types";
import { useTour } from "../use-tour";
import { TourCoach } from "./tour-coach";
import { TourOverlay } from "./tour-overlay";
import { TourStepCardBody } from "./tour-step-card";

const TITLE_ID = "biso-tour-step-title";
const BODY_ID = "biso-tour-step-body";
const DEFAULT_SPOTLIGHT_PADDING = 8;
const CARD_GAP = 10;
const COLLISION_PADDING = 16;
const TRAILING_SLASHES = /\/+$/;
const LEADING_QUESTION = /^\?/;
/** Above the overlay + all app chrome. Inline so it never depends on Tailwind. */
const CARD_Z = 2_147_483_002;

function placementToSide(
  placement?: TourPlacement
): "top" | "right" | "bottom" | "left" {
  if (!placement || placement === "auto") {
    return "bottom";
  }
  return placement;
}

/** Strip query/hash + trailing slashes so two paths compare equal sensibly. */
function normalizePath(path: string): string {
  const base = path.split("?")[0]?.split("#")[0] ?? path;
  const trimmed = base.replace(TRAILING_SLASHES, "");
  return trimmed === "" ? "/" : trimmed;
}

/** True when the current location differs from the step's route (path + query). */
function needsNavigation(route: string): boolean {
  const [routePath, routeQuery = ""] = route.split("?");
  if (
    normalizePath(window.location.pathname) !==
    normalizePath(routePath ?? route)
  ) {
    return true;
  }
  return window.location.search.replace(LEADING_QUESTION, "") !== routeQuery;
}

interface TourRendererProps {
  labels: TourLabels;
  navigate?: (path: string) => void;
  renderStepCard?: (context: TourStepRenderContext) => ReactNode;
  translate?: (key: string) => string;
}

/**
 * Internal. Rendered once by the provider; draws the overlay + step card for the
 * active step, resolving the target (waiting for async mounts), scrolling it into
 * view, and wiring keyboard navigation. Falls back to a centered card whenever a
 * target can't be resolved, so a missing element never crashes the page.
 */
export function TourRenderer({
  translate,
  labels,
  navigate,
  renderStepCard,
}: TourRendererProps) {
  const {
    activeTour,
    currentStep,
    stepIndex,
    totalSteps,
    next,
    back,
    skip,
    finish,
  } = useTour();
  const reducedMotion = usePrefersReducedMotion();
  const [mounted, setMounted] = useState(false);
  const [targetEl, setTargetEl] = useState<HTMLElement | null>(null);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!(activeTour && currentStep)) {
      setTargetEl(null);
      setResolving(false);
      return;
    }

    // Multi-page: jump to the step's route before resolving its target. The
    // selector resolver below then waits for the new page to mount the element.
    if (currentStep.route && navigate && needsNavigation(currentStep.route)) {
      navigate(currentStep.route);
    }

    const target = currentStep.target;
    if (target.type !== "element") {
      setTargetEl(null);
      setResolving(false);
      return;
    }

    let cancelled = false;
    setResolving(true);
    setTargetEl(null);
    resolveTargetElement(target.selector).then((element) => {
      if (cancelled) {
        return;
      }
      setTargetEl(element);
      setResolving(false);
      element?.scrollIntoView({
        block: "center",
        inline: "nearest",
        behavior: reducedMotion ? "auto" : "smooth",
      });
    });

    return () => {
      cancelled = true;
    };
  }, [activeTour, currentStep, reducedMotion, navigate]);

  const rect = useTargetRect(targetEl);
  const isLast = stepIndex === totalSteps - 1;

  useEffect(() => {
    if (!activeTour) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        skip();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        if (isLast) {
          finish();
        } else {
          next();
        }
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        back();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeTour, isLast, next, back, skip, finish]);

  if (!(mounted && activeTour && currentStep)) {
    return null;
  }

  const isCenter =
    currentStep.target.type === "center" || !(resolving || targetEl);
  const padding = currentStep.spotlightPadding ?? DEFAULT_SPOTLIGHT_PADDING;

  const renderContext: TourStepRenderContext = {
    step: currentStep,
    index: stepIndex,
    total: totalSteps,
    isFirst: stepIndex === 0,
    isLast,
    titleId: TITLE_ID,
    bodyId: BODY_ID,
    labels,
    translate,
    onNext: isLast ? finish : next,
    onBack: back,
    onSkip: skip,
  };

  const cardBody = renderStepCard ? (
    renderStepCard(renderContext)
  ) : (
    <TourStepCardBody {...renderContext} />
  );

  return createPortal(
    <div data-biso-tour="">
      <TourOverlay
        padding={padding}
        rect={isCenter || !rect ? null : rect}
        reducedMotion={reducedMotion}
      />
      {currentStep.coach ? (
        <TourCoach coach={currentStep.coach} reducedMotion={reducedMotion} />
      ) : null}
      {isCenter || !rect ? (
        <div
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{ zIndex: CARD_Z }}
        >
          <div className="fade-in-0 zoom-in-95 animate-in">{cardBody}</div>
        </div>
      ) : (
        <Popover open>
          <PopoverAnchor asChild>
            <div
              aria-hidden="true"
              style={{
                position: "fixed",
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height,
                opacity: 0,
                pointerEvents: "none",
              }}
            />
          </PopoverAnchor>
          <PopoverContent
            align="center"
            className="w-auto border-0 bg-transparent p-0 shadow-none"
            collisionPadding={COLLISION_PADDING}
            onEscapeKeyDown={(event) => event.preventDefault()}
            onFocusOutside={(event) => event.preventDefault()}
            onInteractOutside={(event) => event.preventDefault()}
            onPointerDownOutside={(event) => event.preventDefault()}
            side={placementToSide(currentStep.placement)}
            sideOffset={padding + CARD_GAP}
            style={{ zIndex: CARD_Z }}
          >
            {cardBody}
          </PopoverContent>
        </Popover>
      )}
    </div>,
    document.body
  );
}
