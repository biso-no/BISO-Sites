/**
 * JSON-Render Component Registry
 *
 * Maps catalog component types to React components for rendering.
 * Used by the Renderer component to display the UI tree.
 */

"use client";

import type {
  ComponentRegistry,
  ComponentRenderProps,
} from "@json-render/react";
import { AccordionBlock } from "@repo/ui/components/puck/accordion";
import { Collection } from "@repo/ui/components/puck/collection/collection";
import { Columns } from "@repo/ui/components/puck/columns";
import { CTA } from "@repo/ui/components/puck/cta";
import { FeatureGrid } from "@repo/ui/components/puck/feature-grid";
import { FilterBar } from "@repo/ui/components/puck/filter-bar";
import { FilteredEvents } from "@repo/ui/components/puck/filtered-events";
import { FilteredNews } from "@repo/ui/components/puck/filtered-news";
import { Hero } from "@repo/ui/components/puck/hero";
import { JobsList } from "@repo/ui/components/puck/jobs-list";
import { LogoGrid } from "@repo/ui/components/puck/logo-grid";
import { PageHeader } from "@repo/ui/components/puck/page-header";
import { RichText } from "@repo/ui/components/puck/rich-text";
import { Section } from "@repo/ui/components/puck/section";
import { Spacer } from "@repo/ui/components/puck/spacer";
import { StatsGrid } from "@repo/ui/components/puck/stats-grid";
import { TableOfContents } from "@repo/ui/components/puck/table-of-contents";
import { Tabs } from "@repo/ui/components/puck/tabs";
import { TeamGrid } from "@repo/ui/components/puck/team-grid";
import { Timeline } from "@repo/ui/components/puck/timeline";
import { About } from "@repo/ui/components/sections/about";
import { JoinUs } from "@repo/ui/components/sections/join-us";

/**
 * Registry mapping component type names to React components
 *
 * Each component receives ComponentRenderProps:
 * - element: { key, type, props }
 * - children: Rendered child components (if hasChildren: true in catalog)
 * - onAction: Function to trigger catalog-defined actions
 * - loading: Whether parent is loading
 */
export const puckRegistry: ComponentRegistry = {
  // Layout Components
  Section: ({ element, children }: ComponentRenderProps) => (
    <Section {...(element.props as any)}>{children}</Section>
  ),

  Columns: ({ element, children }: ComponentRenderProps) => (
    <Columns {...(element.props as any)}>{children}</Columns>
  ),

  Tabs: ({ element, children }: ComponentRenderProps) => (
    <Tabs {...(element.props as any)}>{children}</Tabs>
  ),

  Spacer: ({ element }: ComponentRenderProps) => (
    <Spacer {...(element.props as any)} />
  ),

  // Hero & Header Components
  Hero: ({ element }: ComponentRenderProps) => (
    <Hero {...(element.props as any)} />
  ),

  PageHeader: ({ element }: ComponentRenderProps) => (
    <PageHeader {...(element.props as any)} />
  ),

  // Content Display Components
  FeatureGrid: ({ element }: ComponentRenderProps) => (
    <FeatureGrid {...(element.props as any)} />
  ),

  StatsGrid: ({ element }: ComponentRenderProps) => (
    <StatsGrid {...(element.props as any)} />
  ),

  TeamGrid: ({ element }: ComponentRenderProps) => (
    <TeamGrid {...(element.props as any)} />
  ),

  Timeline: ({ element }: ComponentRenderProps) => (
    <Timeline {...(element.props as any)} />
  ),

  LogoGrid: ({ element }: ComponentRenderProps) => (
    <LogoGrid {...(element.props as any)} />
  ),

  Accordion: ({ element }: ComponentRenderProps) => (
    <AccordionBlock {...(element.props as any)} />
  ),

  RichText: ({ element }: ComponentRenderProps) => (
    <RichText {...(element.props as any)} />
  ),

  TableOfContents: ({ element }: ComponentRenderProps) => (
    <TableOfContents {...(element.props as any)} />
  ),

  // CTA & Marketing Components
  CTA: ({ element }: ComponentRenderProps) => (
    <CTA {...(element.props as any)} />
  ),

  About: ({ element }: ComponentRenderProps) => (
    <About {...(element.props as any)} />
  ),

  JoinUs: ({ element }: ComponentRenderProps) => {
    // Transform memberFeatures from array to match component expectations
    const props = {
      ...(element.props as any),
      memberFeatures: (element.props as any).memberFeatures || [],
    };
    return <JoinUs {...props} />;
  },

  // Data/List Components
  News: ({ element }: ComponentRenderProps) => (
    <FilteredNews {...(element.props as any)} />
  ),

  Events: ({ element }: ComponentRenderProps) => (
    <FilteredEvents {...(element.props as any)} />
  ),

  JobsList: ({ element }: ComponentRenderProps) => (
    <JobsList {...(element.props as any)} />
  ),

  FilterBar: ({ element }: ComponentRenderProps) => (
    <FilterBar {...(element.props as any)} />
  ),

  Collection: ({ element }: ComponentRenderProps) => (
    <Collection {...(element.props as any)} />
  ),
};

export type PuckRegistry = typeof puckRegistry;
