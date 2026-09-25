/**
 * Lookups and entity resolution.
 *
 * Exact resolution matters more than it looks. The admin assistant's
 * `getM365UserProfile` delegates to `searchM365Users({ query: userId, limit: 1 })`
 * — a fuzzy search truncated to one row — so asking for a specific person
 * returns whoever sorted first, with no signal that the match was approximate.
 * `resolveEntity` below either finds exactly one match or reports the
 * candidates and refuses; it never silently picks one.
 */

import { Query } from "@repo/api";
import type { Campus, Departments } from "@repo/api/types/appwrite";
import {
  FEATURE_FLAGS,
  type FeatureFlagKey,
  mergeFlagStates,
} from "@repo/shared/utils/feature-flags";
import { isPublicUnit } from "@repo/shared/utils/unit-visibility";
import type { BackendClients } from "../appwrite/clients";
import { fromAppwriteError, invalidInput, notFound } from "../runtime/errors";
import type { Projected } from "./row";

const LOOKUP_LIMIT = 500;
const FLAG_LIMIT = 200;
const AMBIGUITY_SAMPLE = 5;

export interface CampusRef {
  id: string;
  name: string;
}

export interface DepartmentRef {
  active: boolean;
  campusId: string;
  id: string;
  name: string;
  /**
   * Whether a student should see this unit listed.
   *
   * `departments` mirrors the 24SevenOffice chart of accounts, so `active` is
   * not a publication flag: operating ledgers (`Drift …`) and national
   * governance bodies are live accounts with no public page. This is
   * `isPublicUnit` from `@repo/shared`, the same filter the public site uses.
   */
  publiclyListed: boolean;
  /** `Name` with the campus prefix intact — this is the MS Graph join key. */
  rawName: string;
  slug: string | null;
  type: string | null;
}

export interface FlagState {
  description: string;
  enabled: boolean;
  group: string;
  /** True when the state comes from the catalogue default, not a stored row. */
  isDefault: boolean;
  key: string;
  title: string;
}

export interface LookupService {
  campuses(): Promise<CampusRef[]>;
  departments(input?: {
    campusId?: string;
    publicOnly?: boolean;
  }): Promise<DepartmentRef[]>;
  featureFlags(): Promise<FlagState[]>;
  isEnabled(key: FeatureFlagKey): Promise<boolean>;
  /** Resolve a name or id to exactly one department, or refuse. */
  resolveDepartment(reference: string): Promise<DepartmentRef>;
}

export function createLookupService(clients: BackendClients): LookupService {
  let campusCache: CampusRef[] | null = null;
  let departmentCache: DepartmentRef[] | null = null;

  async function loadCampuses(): Promise<CampusRef[]> {
    if (campusCache) {
      return campusCache;
    }
    try {
      const result = await clients.user.db.listRows<Campus>("app", "campus", [
        Query.select(["$id", "name"]),
        Query.limit(100),
      ]);
      campusCache = result.rows.map((row) => ({ id: row.$id, name: row.name }));
      return campusCache;
    } catch (error) {
      throw fromAppwriteError(error, { operation: "list campuses" });
    }
  }

  async function loadDepartments(): Promise<DepartmentRef[]> {
    if (departmentCache) {
      return departmentCache;
    }
    try {
      // 500, not 100: `readPageDepartmentsFeed` carries a comment about a
      // prior limit of 100 silently dropping 34 of 134 departments.
      const result = await clients.user.db.listRows<Departments>(
        "app",
        "departments",
        [
          Query.select(["$id", "Name", "campus_id", "slug", "type", "active"]),
          Query.orderAsc("Name"),
          Query.limit(LOOKUP_LIMIT),
        ]
      );
      departmentCache = result.rows.map((row) => ({
        id: row.$id,
        name: row.Name,
        rawName: row.Name,
        campusId: row.campus_id,
        slug: row.slug ?? null,
        type: row.type ?? null,
        active: row.active !== false,
        publiclyListed: isPublicUnit({ Name: row.Name, active: row.active }),
      }));
      return departmentCache;
    } catch (error) {
      throw fromAppwriteError(error, { operation: "list departments" });
    }
  }

  return {
    campuses: loadCampuses,

    async departments(input = {}) {
      const all = await loadDepartments();
      return all.filter((department) => {
        if (input.campusId && department.campusId !== input.campusId) {
          return false;
        }
        if (input.publicOnly && !department.publiclyListed) {
          return false;
        }
        return true;
      });
    },

    async resolveDepartment(reference) {
      const trimmed = reference.trim();
      if (!trimmed) {
        throw invalidInput("A department reference is required.");
      }
      const all = await loadDepartments();

      const byId = all.find((department) => department.id === trimmed);
      if (byId) {
        return byId;
      }

      const lowered = trimmed.toLowerCase();
      const exact = all.filter(
        (department) =>
          department.name.toLowerCase() === lowered ||
          department.slug?.toLowerCase() === lowered
      );
      if (exact.length === 1) {
        return exact[0];
      }
      if (exact.length > 1) {
        throw invalidInput(
          `"${trimmed}" matches ${exact.length} departments across campuses. Pass the department id, or add a campus filter.`,
          {
            candidates: exact.slice(0, AMBIGUITY_SAMPLE).map((department) => ({
              id: department.id,
              name: department.name,
              campusId: department.campusId,
            })),
          }
        );
      }

      const partial = all.filter((department) =>
        department.name.toLowerCase().includes(lowered)
      );
      if (partial.length === 1) {
        return partial[0];
      }
      if (partial.length === 0) {
        throw notFound(`No department matches "${trimmed}".`, {
          reference: trimmed,
        });
      }
      throw invalidInput(
        `"${trimmed}" is ambiguous: ${partial.length} departments match.`,
        {
          candidates: partial.slice(0, AMBIGUITY_SAMPLE).map((department) => ({
            id: department.id,
            name: department.name,
            campusId: department.campusId,
          })),
        }
      );
    },

    async featureFlags() {
      // The code catalogue in `@repo/shared/utils/feature-flags` decides which
      // flags exist and what they default to; the table only stores overrides.
      // A row whose key is not in the catalogue gates nothing and is ignored.
      let stored: Array<{ key: string; enabled: boolean }> = [];
      try {
        const result = await clients.user.db.listRows<
          Projected<{ key: string; enabled: boolean }>
        >("app", "feature_flags", [
          Query.select(["key", "enabled"]),
          Query.limit(FLAG_LIMIT),
        ]);
        stored = result.rows.map((row) => ({
          key: row.key,
          enabled: row.enabled,
        }));
      } catch (error) {
        throw fromAppwriteError(error, { operation: "read feature flags" });
      }

      const overrides = new Set(stored.map((row) => row.key));
      const states = mergeFlagStates(stored);
      return FEATURE_FLAGS.map((flag) => ({
        key: flag.key,
        title: flag.title,
        group: flag.group,
        enabled: states[flag.key as FeatureFlagKey],
        isDefault: !overrides.has(flag.key),
        description: flag.description,
      }));
    },

    async isEnabled(key) {
      const flags = await this.featureFlags();
      const match = flags.find((flag) => flag.key === key);
      return match?.enabled ?? false;
    },
  };
}
