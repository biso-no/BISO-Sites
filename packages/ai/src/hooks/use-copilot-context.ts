"use client";

import { useEffect } from "react";
import {
  type EntityContext,
  type EntityType,
  type PageContext,
  useCopilotStore,
} from "../stores/copilot-store";

/**
 * Options for registering entity context with the copilot
 */
type UseEntityContextOptions = {
  /** The type of entity */
  type: EntityType;
  /** The entity ID */
  id: string;
  /** Human-readable title */
  title: string;
  /** The full entity data - AI can read this */
  data: Record<string, unknown>;
  /** Optional locale */
  locale?: string;
  /** Optional metadata */
  metadata?: EntityContext["metadata"];
};

/**
 * Hook to register entity context with the AI copilot
 * Use this when viewing/editing an entity (event, job, page, etc.)
 *
 * @example
 * ```tsx
 * // In an event editor
 * useEntityContext({
 *   type: "event",
 *   id: event.$id,
 *   title: event.translation_refs?.[0]?.title || event.slug,
 *   data: event,
 *   metadata: { status: event.status }
 * });
 * ```
 */
export function useEntityContext(options: UseEntityContextOptions | null) {
  const setEntityContext = useCopilotStore((state) => state.setEntityContext);

  useEffect(() => {
    if (options) {
      setEntityContext({
        type: options.type,
        id: options.id,
        title: options.title,
        data: options.data,
        locale: options.locale,
        metadata: options.metadata,
      });
    } else {
      setEntityContext(null);
    }

    // Clear context on unmount
    return () => {
      setEntityContext(null);
    };
  }, [
    options?.type,
    options?.id,
    options?.title,
    options?.locale,
    setEntityContext,
    options?.data,
    options,
  ]);
}

/**
 * Options for registering page context with the copilot
 */
type UsePageContextOptions = {
  /** What section of admin we're in */
  section: PageContext["section"];
  /** Is this a list view, detail view, or editor? */
  viewType: PageContext["viewType"];
  /** Breadcrumb path */
  breadcrumb?: string[];
  /** Any filters/search applied */
  filters?: Record<string, unknown>;
  /** Summary of list items (for list views) */
  listSummary?: PageContext["listSummary"];
};

/**
 * Hook to register page context with the AI copilot
 * Use this to provide broader context about the current page
 *
 * @example
 * ```tsx
 * // In an events list page
 * usePageContext({
 *   section: "events",
 *   viewType: "list",
 *   listSummary: {
 *     totalCount: events.length,
 *     displayedCount: filteredEvents.length,
 *     items: filteredEvents.slice(0, 10).map(e => ({
 *       id: e.$id,
 *       title: e.title,
 *       status: e.status
 *     }))
 *   }
 * });
 * ```
 */
export function usePageContext(options: UsePageContextOptions) {
  const setPageContext = useCopilotStore((state) => state.setPageContext);

  useEffect(() => {
    setPageContext({
      section: options.section,
      viewType: options.viewType,
      breadcrumb: options.breadcrumb,
      filters: options.filters,
      listSummary: options.listSummary,
    });

    // Clear context on unmount
    return () => {
      setPageContext(null);
    };
  }, [
    options.section,
    options.viewType,
    options.breadcrumb,
    options.filters,
    options.listSummary,
    setPageContext,
  ]);
}

/**
 * Helper to create entity context from common admin types
 */
export const createEntityContext = {
  /**
   * Create context for an event
   */
  event: (event: {
    $id: string;
    slug: string;
    status?: string;
    translation_refs?: Array<{
      title?: string;
      description?: string;
      locale?: string;
    }>;
    start_date?: string;
    end_date?: string;
    location?: string;
    [key: string]: unknown;
  }): UseEntityContextOptions => ({
    type: "event",
    id: event.$id,
    title: event.translation_refs?.[0]?.title || event.slug,
    data: event,
    locale: event.translation_refs?.[0]?.locale,
    metadata: {
      status: event.status,
    },
  }),

  /**
   * Create context for a job
   */
  job: (job: {
    $id: string;
    slug: string;
    status?: string;
    translation_refs?: Array<{
      title?: string;
      description?: string;
      locale?: string;
    }>;
    deadline?: string;
    [key: string]: unknown;
  }): UseEntityContextOptions => ({
    type: "job",
    id: job.$id,
    title: job.translation_refs?.[0]?.title || job.slug,
    data: job,
    locale: job.translation_refs?.[0]?.locale,
    metadata: {
      status: job.status,
    },
  }),

  /**
   * Create context for a page
   */
  page: (
    page: {
      id: string;
      slug: string;
      status?: string;
      translations?: Array<{
        title?: string;
        locale?: string;
        draftDocument?: unknown;
      }>;
      [key: string]: unknown;
    },
    locale?: string
  ): UseEntityContextOptions => {
    const translation = locale
      ? page.translations?.find((t) => t.locale === locale)
      : page.translations?.[0];
    return {
      type: "page",
      id: page.id,
      title: translation?.title || page.slug,
      data: page,
      locale: translation?.locale,
      metadata: {
        status: page.status,
      },
    };
  },

  /**
   * Create context for a product
   */
  product: (product: {
    $id: string;
    slug?: string;
    name?: string;
    status?: string;
    price?: number;
    [key: string]: unknown;
  }): UseEntityContextOptions => ({
    type: "product",
    id: product.$id,
    title: product.name || product.slug || product.$id,
    data: product,
    metadata: {
      status: product.status,
    },
  }),

  /**
   * Create context for a post
   */
  post: (post: {
    $id: string;
    slug: string;
    status?: string;
    translation_refs?: Array<{ title?: string; locale?: string }>;
    [key: string]: unknown;
  }): UseEntityContextOptions => ({
    type: "post",
    id: post.$id,
    title: post.translation_refs?.[0]?.title || post.slug,
    data: post,
    locale: post.translation_refs?.[0]?.locale,
    metadata: {
      status: post.status,
    },
  }),
};
