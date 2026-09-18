/**
 * The service container.
 *
 * One concrete object with named, typed members. A tool reaches for
 * `services.content.search(...)` and the compiler checks both that the service
 * exists and that the call matches its contract — the property the admin
 * assistant's `Record<string, (...args: unknown[]) => Promise<unknown>>` cannot
 * give, where a missing key is a runtime `TypeError` and every call site casts.
 */

import type { BackendClients } from "../appwrite/clients";
import type { ApprovalService } from "./approvals";
import { createApprovalService } from "./approvals";
import type { CommerceService } from "./commerce";
import { createCommerceService } from "./commerce";
import type { ContentService } from "./content";
import { createContentService } from "./content";
import type { DiscoveryService } from "./discovery";
import { createDiscoveryService } from "./discovery";
import type { EventsService } from "./events";
import { createEventsService } from "./events";
import type { LookupService } from "./lookups";
import { createLookupService } from "./lookups";
import type { OperationsService } from "./operations";
import { createOperationsService } from "./operations";
import type { PageService } from "./pages";
import { createPageService } from "./pages";
import type { RecruitmentService } from "./recruitment";
import { createRecruitmentService } from "./recruitment";

export interface Services {
  approvals: ApprovalService;
  commerce: CommerceService;
  content: ContentService;
  discovery: DiscoveryService;
  events: EventsService;
  lookups: LookupService;
  operations: OperationsService;
  pages: PageService;
  recruitment: RecruitmentService;
}

export interface ServiceLinks {
  admin(path: string): string;
  web(path: string): string;
}

export function createServices(
  clients: BackendClients,
  links: ServiceLinks
): Services {
  // `lookups` is shared rather than built twice: it caches campuses and
  // departments, and recruitment's scope resolution needs the same view.
  const lookups = createLookupService(clients);
  return {
    approvals: createApprovalService(clients),
    commerce: createCommerceService(clients),
    content: createContentService(clients, links),
    discovery: createDiscoveryService(clients, links),
    events: createEventsService(clients),
    lookups,
    operations: createOperationsService(clients),
    pages: createPageService(clients, links),
    recruitment: createRecruitmentService(clients, lookups),
  };
}
