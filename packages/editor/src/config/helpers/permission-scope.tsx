"use client";

import type { PuckMetadata } from "@puckeditor/core";
import { Lock } from "lucide-react";
import type { DataSourceValue } from "../types";
import { buildPageScopeFilters } from "../utils";
import { SCOPE_FIELD } from "./dynamic-data";

export type ScopeUser = NonNullable<PuckMetadata["user"]>;

/** True when the user is a department-only editor (not global or campus admin). */
export function isDepartmentUser(user: ScopeUser | undefined): boolean {
  if (!user) {
    return false;
  }
  return (
    !(user.isGlobalAdmin || user.isCampusAdmin) &&
    user.departmentNames.length > 0
  );
}

/**
 * Returns the appropriate scope radio field options for the given user role.
 *
 * - Global admin    → standard "This page / All content" radio (unchanged)
 * - Campus admin    → "This campus / All campuses" (relabelled, same values)
 * - Department user → null (scope field should be hidden; use buildLockedScopeField instead)
 */
export function getScopeFieldForUser(user: ScopeUser | undefined) {
  if (!user || user.isGlobalAdmin) {
    return SCOPE_FIELD;
  }
  if (user.isCampusAdmin) {
    return {
      type: "radio" as const,
      label: "Scope",
      options: [
        { label: "This campus", value: "page" },
        { label: "All campuses", value: "all" },
      ],
    };
  }
  return null;
}

/**
 * Builds a read-only Puck `custom` field that displays a locked scope
 * indicator badge in the sidebar, used in place of the scope radio for
 * department users.
 */
export function buildLockedScopeField(deptName: string) {
  return {
    type: "custom" as const,
    label: "Content Scope",
    render: () => <LockedScopeIndicator deptName={deptName} />,
  };
}

function LockedScopeIndicator({ deptName }: { deptName: string }) {
  return (
    <div
      className="flex items-center gap-2 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-sm"
      title="Content is locked to your department"
    >
      <Lock className="h-3.5 w-3.5 shrink-0 text-blue-400" />
      <div className="min-w-0 flex-1">
        <span className="block truncate font-medium text-blue-700">
          {deptName}
        </span>
        <span className="block text-blue-400 text-xs">
          Filtered to your department
        </span>
      </div>
    </div>
  );
}

/**
 * Computes the effective scope to use in resolveData for a given user.
 *
 * Department users are always forced to "page" scope (their department),
 * regardless of what the editor field says. All other users use the value
 * stored on the block's props.
 */
export function getEffectiveScope(
  propScope: "page" | "all" | undefined,
  user: ScopeUser | undefined
): "page" | "all" | undefined {
  if (isDepartmentUser(user)) {
    return "page";
  }
  return propScope;
}

/** Campus name → hardcoded Appwrite document value mapping. */
export const CAMPUS_OPTIONS = [
  { label: "Oslo", value: "1" },
  { label: "Bergen", value: "2" },
  { label: "Trondheim", value: "3" },
  { label: "Stavanger", value: "4" },
  { label: "National", value: "5" },
] as const;

/** Converts a campus name string to its value (e.g. "Oslo" → "1"). */
function _campusNameToValue(name: string): string | undefined {
  return CAMPUS_OPTIONS.find(
    (o) => o.label.toLowerCase() === name.toLowerCase()
  )?.value;
}

/**
 * Builds a locked campus indicator field for the page root panel.
 * Shown to campus admins and department users instead of the campus select.
 */
export function buildLockedCampusField(campusName: string) {
  return {
    type: "custom" as const,
    label: "Campus",
    render: () => <LockedCampusIndicator campusName={campusName} />,
  };
}

function LockedCampusIndicator({ campusName }: { campusName: string }) {
  return (
    <div
      className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
      title="Campus is determined by your role"
    >
      <Lock className="h-3.5 w-3.5 shrink-0 text-gray-400" />
      <span className="font-medium text-gray-700">
        {campusName || "Your campus"}
      </span>
      <span className="ml-auto text-gray-400 text-xs">Role-locked</span>
    </div>
  );
}

/**
 * Builds a locked department indicator field for the page root panel.
 * Shown to department users instead of the department select.
 */
export function buildLockedDepartmentField(deptName: string) {
  return {
    type: "custom" as const,
    label: "Department",
    render: () => <LockedDeptIndicator deptName={deptName} />,
  };
}

function LockedDeptIndicator({ deptName }: { deptName: string }) {
  return (
    <div
      className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
      title="Department is determined by your role"
    >
      <Lock className="h-3.5 w-3.5 shrink-0 text-gray-400" />
      <span className="font-medium text-gray-700">{deptName}</span>
      <span className="ml-auto text-gray-400 text-xs">Role-locked</span>
    </div>
  );
}

/**
 * Returns mandatory scope filters that must always be applied in resolveData,
 * regardless of the block's configured scope.
 *
 * - Global admin / campus admin → [] (they can use the scope field freely)
 * - Department user              → department_id filter (forces their content)
 */
async function _getMandatoryScopeFilters(
  table: "events" | "news" | "jobs" | "products",
  user: ScopeUser | undefined,
  metadata: PuckMetadata | undefined
): Promise<DataSourceValue["filters"]> {
  if (!(user && isDepartmentUser(user))) {
    return [];
  }

  const deptName = user.departmentNames[0];
  if (!deptName) {
    return [];
  }

  const syntheticMeta: PuckMetadata = {
    ...metadata,
    page: {
      ...(metadata?.page ?? {}),
      departmentId: deptName,
    },
  };

  return buildPageScopeFilters(table, "page", syntheticMeta);
}
