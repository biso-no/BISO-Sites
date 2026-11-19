"use client";

import { type CSSProperties, useState, useTransition } from "react";
import { toast } from "sonner";
import { STUDIO, studioSurface } from "../../../../_components/studio";
import {
  getProjectsView,
  setProjectEventDate,
  syncProjectsFromFinago,
} from "../actions";
import {
  filterGroups,
  type ProjectsView,
  type ProjectView,
} from "../projects-model";

export interface ProjectsLabels {
  allDepartments: string;
  clear: string;
  cleared: string;
  department: string;
  /** Messages for the action error codes. */
  errors: Record<string, string>;
  eventDate: string;
  firstBooking: string;
  lastBooking: string;
  /** Contains `{time}`. */
  lastSynced: string;
  neverSynced: string;
  noMatch: string;
  none: string;
  notSet: string;
  noUsers: string;
  peak: string;
  save: string;
  saved: string;
  saveError: string;
  sync: string;
  /** Contains `{count}`. */
  syncDone: string;
  syncError: string;
  syncing: string;
  /** Contains `{count}`. */
  syncPartial: string;
  usedBy: string;
  year: string;
}

interface ProjectsClientProps {
  initialView: ProjectsView;
  labels: ProjectsLabels;
  locale: string;
}

const inputStyle: CSSProperties = {
  background: STUDIO.white,
  border: `0.5px solid ${STUDIO.rule2}`,
  borderRadius: 8,
  color: STUDIO.ink,
  fontSize: 13,
  padding: "6px 10px",
};

const buttonStyleFor = (primary: boolean): CSSProperties => ({
  background: primary ? STUDIO.ink : STUDIO.white,
  border: `0.5px solid ${STUDIO.rule2}`,
  borderRadius: 8,
  color: primary ? STUDIO.white : STUDIO.ink,
  fontSize: 13,
  fontWeight: 500,
  padding: "6px 14px",
});

function formatDay(value: string | null, locale: string): string {
  if (!value) {
    return "–";
  }
  return new Date(`${value}T00:00:00Z`).toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  });
}

interface RowProps {
  labels: ProjectsLabels;
  locale: string;
  onSaved: () => Promise<void>;
  project: ProjectView;
}

function ProjectRow({ labels, locale, onSaved, project }: RowProps) {
  const [date, setDate] = useState(project.eventDate ?? "");
  const [pending, startTransition] = useTransition();

  const save = (next: string | null) =>
    startTransition(async () => {
      const result = await setProjectEventDate(project.id, next);
      if ("error" in result) {
        toast.error(labels.errors[result.error] ?? labels.saveError);
        return;
      }
      if (next === null) {
        setDate("");
      }
      toast.success(next === null ? labels.cleared : labels.saved);
      await onSaved();
    });

  const dirty = date !== (project.eventDate ?? "");

  return (
    <tr className="align-top text-[13px]">
      <td className="py-2 pr-3">{project.name}</td>
      <td className="py-2 pr-3">{project.year ?? "–"}</td>
      <td className="py-2 pr-3">
        {project.departments.length > 0
          ? project.departments.map((d) => d.name).join(", ")
          : labels.noUsers}
      </td>
      <td className="py-2 pr-3">{formatDay(project.firstLineDate, locale)}</td>
      <td className="py-2 pr-3">{formatDay(project.lastLineDate, locale)}</td>
      <td className="py-2 pr-3">{formatDay(project.peakDate, locale)}</td>
      <td className="py-2">
        <div className="flex flex-wrap items-center gap-2">
          <input
            aria-label={`${labels.eventDate}: ${project.name}`}
            disabled={pending}
            onChange={(event) => setDate(event.target.value)}
            style={inputStyle}
            type="date"
            value={date}
          />
          <button
            disabled={pending || !dirty || date === ""}
            onClick={() => save(date)}
            style={buttonStyleFor(true)}
            type="button"
          >
            {labels.save}
          </button>
          {project.eventDate && (
            <button
              disabled={pending}
              onClick={() => save(null)}
              style={buttonStyleFor(false)}
              type="button"
            >
              {labels.clear}
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

export function ProjectsClient({
  initialView,
  labels,
  locale,
}: ProjectsClientProps) {
  const [view, setView] = useState(initialView);
  const [departmentId, setDepartmentId] = useState("");
  const [pending, startTransition] = useTransition();

  const reload = async () => {
    try {
      setView(await getProjectsView());
    } catch {
      // Keep what is on screen; the save itself already succeeded.
    }
  };

  const handleSync = () =>
    startTransition(async () => {
      const result = await syncProjectsFromFinago();
      if ("error" in result) {
        toast.error(labels.syncError);
        return;
      }
      const { partial, projects } = result.data;
      const message = partial ? labels.syncPartial : labels.syncDone;
      toast.success(message.replace("{count}", String(projects)));
      await reload();
    });

  const groups = filterGroups(view.groups, departmentId);
  const lastSynced = view.lastSyncedAt
    ? labels.lastSynced.replace(
        "{time}",
        new Date(view.lastSyncedAt).toLocaleString(locale)
      )
    : labels.neverSynced;

  return (
    <section className="mt-6 rounded-2xl p-5" style={studioSurface}>
      <div className="flex flex-wrap items-center gap-3">
        <button
          disabled={pending}
          onClick={handleSync}
          style={buttonStyleFor(true)}
          type="button"
        >
          {pending ? labels.syncing : labels.sync}
        </button>
        <span className="text-[13px]" style={{ color: STUDIO.ink4 }}>
          {lastSynced}
        </span>
        <label className="ml-auto flex items-center gap-2 text-[13px]">
          <span style={{ color: STUDIO.ink4 }}>{labels.department}</span>
          <select
            onChange={(event) => setDepartmentId(event.target.value)}
            style={inputStyle}
            value={departmentId}
          >
            <option value="">{labels.allDepartments}</option>
            {view.departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {groups.length === 0 && (
        <p className="mt-6 text-[13px]" style={{ color: STUDIO.ink4 }}>
          {view.groups.length === 0 ? labels.none : labels.noMatch}
        </p>
      )}

      {groups.map((group) => (
        <div className="mt-6" key={group.series}>
          <h3 className="font-medium text-[14px]">{group.series}</h3>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[12px]" style={{ color: STUDIO.ink4 }}>
                  <th className="pb-2 font-normal" scope="col" />
                  <th className="pb-2 font-normal" scope="col">
                    {labels.year}
                  </th>
                  <th className="pb-2 font-normal" scope="col">
                    {labels.usedBy}
                  </th>
                  <th className="pb-2 font-normal" scope="col">
                    {labels.firstBooking}
                  </th>
                  <th className="pb-2 font-normal" scope="col">
                    {labels.lastBooking}
                  </th>
                  <th className="pb-2 font-normal" scope="col">
                    {labels.peak}
                  </th>
                  <th className="pb-2 font-normal" scope="col">
                    {labels.eventDate}
                  </th>
                </tr>
              </thead>
              <tbody>
                {group.projects.map((project) => (
                  <ProjectRow
                    key={`${project.id}-${project.eventDate}`}
                    labels={labels}
                    locale={locale}
                    onSaved={reload}
                    project={project}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </section>
  );
}
