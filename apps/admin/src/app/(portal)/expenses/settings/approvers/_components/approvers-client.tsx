"use client";

import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Switch } from "@repo/ui/components/ui/switch";
import { useLocale } from "next-intl";
import {
  type CSSProperties,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import { STUDIO, studioSurface } from "../../../../_components/studio";
import { normalizeLocale } from "../../../../shop/_components/shop-studio-theme";
import {
  listApprovers,
  saveApprover,
  setApproverActive,
} from "../approvers-actions";
import {
  type ApproverErrorCode,
  type ApproverInput,
  type ApproverNameDraft,
  type ApproverView,
  DEPARTMENT_ROLES,
  nameAfterEmailChange,
} from "../approvers-model";

export interface ApproversLabels {
  actions: string;
  active: string;
  add: string;
  allCampuses: string;
  allRoles: string;
  campus: string;
  campusScope: string;
  cancel: string;
  /** Shown when the list stops at the cap. */
  capped: string;
  confidence: string;
  department: string;
  departmentScope: string;
  dialogAdd: string;
  dialogEdit: string;
  edit: string;
  email: string;
  emailHint: string;
  empty: string;
  errors: Record<ApproverErrorCode, string>;
  lastConfirmed: string;
  lastUsed: string;
  loadError: string;
  name: string;
  never: string;
  role: string;
  roleLabels: Record<string, string>;
  save: string;
  saved: string;
  saveError: string;
  scope: string;
  search: string;
  source: string;
  sources: Record<"admin" | "ai" | "confirmed" | "seed", string>;
}

interface ApproversClientProps {
  allowCampusScope: boolean;
  campuses: { id: string; name: string }[];
  departments: { campusId: string; id: string; name: string }[];
  initialCapped: boolean;
  initialRows: ApproverView[];
  labels: ApproversLabels;
  roles: string[];
}

const inputStyle: CSSProperties = {
  background: STUDIO.white,
  border: `0.5px solid ${STUDIO.rule2}`,
  borderRadius: 8,
  color: STUDIO.ink,
  fontSize: 13,
  padding: "6px 10px",
  width: "100%",
};

const PERCENT = 100;
const SEARCH_DEBOUNCE_MS = 300;

interface Draft extends ApproverNameDraft {
  campusId: string;
  departmentId: string;
  email: string;
  id?: string;
  role: string;
  scope: "campus" | "department";
}

interface Filters {
  campus: string;
  q: string;
  role: string;
}

function formatDate(
  value: string | null,
  locale: string,
  fallback: string
): string {
  return value
    ? new Date(value).toLocaleDateString(
        normalizeLocale(locale) === "no" ? "nb-NO" : "en-GB"
      )
    : fallback;
}

function Field({
  children,
  label,
  htmlFor,
}: {
  children: React.ReactNode;
  htmlFor: string;
  label: string;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-[13px]" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
    </div>
  );
}

export function ApproversClient({
  allowCampusScope,
  campuses,
  departments,
  initialCapped,
  initialRows,
  labels,
  roles,
}: ApproversClientProps) {
  const locale = useLocale();
  const [rows, setRows] = useState(initialRows);
  const [capped, setCapped] = useState(initialCapped);
  const [campusFilter, setCampusFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pending, startTransition] = useTransition();
  const baseId = useId();
  // Only the latest list request may set the rows; a slower, older answer
  // to an earlier filter is dropped.
  const latestRequest = useRef(0);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );

  useEffect(() => () => clearTimeout(searchTimer.current), []);

  const reload = (next: Filters) => {
    clearTimeout(searchTimer.current);
    latestRequest.current += 1;
    const request = latestRequest.current;
    startTransition(async () => {
      const result = await listApprovers({
        campusId: next.campus || null,
        q: next.q,
        role: next.role || null,
      });
      if (request !== latestRequest.current) {
        return;
      }
      if ("error" in result) {
        toast.error(labels.loadError);
        return;
      }
      setRows(result.data.rows);
      setCapped(result.data.capped);
    });
  };

  const reloadSoon = (next: Filters) => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => reload(next), SEARCH_DEBOUNCE_MS);
  };

  const errorText = (code: ApproverErrorCode) =>
    labels.errors[code] ?? labels.saveError;

  const openAdd = () =>
    setDraft({
      campusId: campuses[0]?.id ?? "",
      departmentId: "",
      displayName: "",
      email: "",
      nameTouched: false,
      originalEmail: "",
      originalName: "",
      role: roles[0] ?? "finance",
      scope: "department",
    });

  const openEdit = (row: ApproverView) =>
    setDraft({
      campusId: row.campusId,
      departmentId: row.departmentId ?? "",
      displayName: row.displayName ?? "",
      email: row.email,
      id: row.$id,
      nameTouched: false,
      originalEmail: row.email,
      originalName: row.displayName ?? "",
      role: row.role,
      scope: row.scope === "campus" ? "campus" : "department",
    });

  const submit = () => {
    if (!draft) {
      return;
    }
    const input: ApproverInput = {
      campusId: draft.campusId,
      departmentId: draft.scope === "department" ? draft.departmentId : null,
      displayName: draft.displayName,
      email: draft.email,
      id: draft.id,
      role: draft.role,
      scope: draft.scope,
    };
    startTransition(async () => {
      const result = await saveApprover(input);
      if ("error" in result) {
        toast.error(errorText(result.error));
        return;
      }
      toast.success(labels.saved);
      setDraft(null);
      reload({ campus: campusFilter, q: query, role: roleFilter });
    });
  };

  const toggle = (row: ApproverView, active: boolean) => {
    startTransition(async () => {
      const result = await setApproverActive({ active, id: row.$id });
      if ("error" in result) {
        toast.error(errorText(result.error));
        return;
      }
      setRows((current) =>
        current.map((item) =>
          item.$id === row.$id ? { ...item, active } : item
        )
      );
    });
  };

  const isDepartmentRole = (role: string) =>
    (DEPARTMENT_ROLES as readonly string[]).includes(role);
  const roleChoices = roles.filter(
    (role) =>
      (draft?.scope === "campus") !== isDepartmentRole(role) ||
      role === draft?.role
  );
  const draftDepartments = departments.filter(
    (department) => department.campusId === draft?.campusId
  );

  return (
    <section className="rounded-2xl p-5" style={studioSurface}>
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label={labels.campus}
          onChange={(event) => {
            setCampusFilter(event.target.value);
            reload({ campus: event.target.value, q: query, role: roleFilter });
          }}
          style={{ ...inputStyle, width: "auto" }}
          value={campusFilter}
        >
          <option value="">{labels.allCampuses}</option>
          {campuses.map((campus) => (
            <option key={campus.id} value={campus.id}>
              {campus.name}
            </option>
          ))}
        </select>
        <select
          aria-label={labels.role}
          onChange={(event) => {
            setRoleFilter(event.target.value);
            reload({
              campus: campusFilter,
              q: query,
              role: event.target.value,
            });
          }}
          style={{ ...inputStyle, width: "auto" }}
          value={roleFilter}
        >
          <option value="">{labels.allRoles}</option>
          {roles.map((role) => (
            <option key={role} value={role}>
              {labels.roleLabels[role] ?? role}
            </option>
          ))}
        </select>
        <input
          aria-label={labels.search}
          onChange={(event) => {
            setQuery(event.target.value);
            reloadSoon({
              campus: campusFilter,
              q: event.target.value,
              role: roleFilter,
            });
          }}
          placeholder={labels.search}
          style={{ ...inputStyle, maxWidth: 260 }}
          type="search"
          value={query}
        />
        <Button className="ml-auto" onClick={openAdd} type="button">
          {labels.add}
        </Button>
      </div>

      {capped ? (
        <p
          className="mt-4 text-[13px]"
          role="status"
          style={{ color: STUDIO.ink3 }}
        >
          {labels.capped}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p className="mt-6 text-[13px]" style={{ color: STUDIO.ink3 }}>
          {labels.empty}
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead style={{ color: STUDIO.ink3 }}>
              <tr>
                <th className="py-2 pr-3 font-medium">{labels.department}</th>
                <th className="py-2 pr-3 font-medium">{labels.role}</th>
                <th className="py-2 pr-3 font-medium">{labels.name}</th>
                <th className="py-2 pr-3 font-medium">{labels.email}</th>
                <th className="py-2 pr-3 font-medium">{labels.source}</th>
                <th className="py-2 pr-3 font-medium">
                  {labels.lastConfirmed}
                </th>
                <th className="py-2 pr-3 font-medium">{labels.lastUsed}</th>
                <th className="py-2 pr-3 font-medium">{labels.active}</th>
                <th className="py-2 font-medium">
                  <span className="sr-only">{labels.actions}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.$id}
                  style={{ borderTop: `0.5px solid ${STUDIO.rule}` }}
                >
                  <td className="py-2 pr-3">
                    {row.scope === "campus"
                      ? (campuses.find((campus) => campus.id === row.campusId)
                          ?.name ?? row.campusId)
                      : (row.departmentName ?? row.departmentId)}
                  </td>
                  <td className="py-2 pr-3">
                    {labels.roleLabels[row.role] ?? row.role}
                  </td>
                  <td className="py-2 pr-3">{row.displayName ?? ""}</td>
                  <td className="py-2 pr-3">{row.email}</td>
                  <td className="py-2 pr-3">
                    <Badge variant="outline">
                      {labels.sources[
                        row.source as keyof ApproversLabels["sources"]
                      ] ?? row.source}
                    </Badge>
                    {row.source === "ai" && row.confidence !== null ? (
                      <span
                        className="ml-2 text-[12px]"
                        style={{ color: STUDIO.ink3 }}
                        title={labels.confidence}
                      >
                        {Math.round(row.confidence * PERCENT)}%
                      </span>
                    ) : null}
                  </td>
                  <td className="py-2 pr-3">
                    {formatDate(row.confirmedAt, locale, labels.never)}
                  </td>
                  <td className="py-2 pr-3">
                    {formatDate(row.lastUsedAt, locale, labels.never)}
                  </td>
                  <td className="py-2 pr-3">
                    <Switch
                      aria-label={labels.active}
                      checked={row.active}
                      disabled={pending || !row.editable}
                      onCheckedChange={(checked) => toggle(row, checked)}
                    />
                  </td>
                  <td className="py-2">
                    {row.editable ? (
                      <Button
                        onClick={() => openEdit(row)}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        {labels.edit}
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setDraft(null);
          }
        }}
        open={draft !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {draft?.id ? labels.dialogEdit : labels.dialogAdd}
            </DialogTitle>
          </DialogHeader>
          {draft ? (
            <div className="space-y-3">
              {allowCampusScope ? (
                <Field htmlFor={`${baseId}-scope`} label={labels.scope}>
                  <select
                    disabled={Boolean(draft.id)}
                    id={`${baseId}-scope`}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        role:
                          event.target.value === "campus"
                            ? "controller"
                            : "finance",
                        scope:
                          event.target.value === "campus"
                            ? "campus"
                            : "department",
                      })
                    }
                    style={inputStyle}
                    value={draft.scope}
                  >
                    <option value="department">{labels.departmentScope}</option>
                    <option value="campus">{labels.campusScope}</option>
                  </select>
                </Field>
              ) : null}
              <Field htmlFor={`${baseId}-campus`} label={labels.campus}>
                <select
                  disabled={Boolean(draft.id)}
                  id={`${baseId}-campus`}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      campusId: event.target.value,
                      departmentId: "",
                    })
                  }
                  style={inputStyle}
                  value={draft.campusId}
                >
                  {campuses.map((campus) => (
                    <option key={campus.id} value={campus.id}>
                      {campus.name}
                    </option>
                  ))}
                </select>
              </Field>
              {draft.scope === "department" ? (
                <Field htmlFor={`${baseId}-dept`} label={labels.department}>
                  <select
                    disabled={Boolean(draft.id)}
                    id={`${baseId}-dept`}
                    onChange={(event) =>
                      setDraft({ ...draft, departmentId: event.target.value })
                    }
                    style={inputStyle}
                    value={draft.departmentId}
                  >
                    <option value="" />
                    {draftDepartments.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.name}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : null}
              <Field htmlFor={`${baseId}-role`} label={labels.role}>
                <select
                  id={`${baseId}-role`}
                  onChange={(event) =>
                    setDraft({ ...draft, role: event.target.value })
                  }
                  style={inputStyle}
                  value={draft.role}
                >
                  {roleChoices.map((role) => (
                    <option key={role} value={role}>
                      {labels.roleLabels[role] ?? role}
                    </option>
                  ))}
                </select>
              </Field>
              <Field htmlFor={`${baseId}-email`} label={labels.email}>
                <input
                  id={`${baseId}-email`}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      displayName: nameAfterEmailChange(
                        draft,
                        event.target.value
                      ),
                      email: event.target.value,
                    })
                  }
                  placeholder="name@biso.no"
                  style={inputStyle}
                  type="email"
                  value={draft.email}
                />
                <p className="text-[12px]" style={{ color: STUDIO.ink3 }}>
                  {labels.emailHint}
                </p>
              </Field>
              <Field htmlFor={`${baseId}-name`} label={labels.name}>
                <input
                  id={`${baseId}-name`}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      displayName: event.target.value,
                      nameTouched: true,
                    })
                  }
                  style={inputStyle}
                  value={draft.displayName}
                />
              </Field>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              onClick={() => setDraft(null)}
              type="button"
              variant="outline"
            >
              {labels.cancel}
            </Button>
            <Button
              disabled={
                pending ||
                !draft?.email.trim() ||
                (draft.scope === "department" && !draft.departmentId)
              }
              onClick={submit}
              type="button"
            >
              {labels.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
