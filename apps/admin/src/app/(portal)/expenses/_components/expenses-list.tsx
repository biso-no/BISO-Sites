"use client";

import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { EmptyState } from "../../_components/empty-state";
import { PaginationBar } from "../../_components/pagination-bar";
import { SearchToolbar } from "../../_components/search-toolbar";
import { MONO_STACK, STUDIO } from "../../_components/studio";
import { useListParams, useUrlSearch } from "../../_components/use-list-params";
import {
  fmtDate,
  fmtNOK,
  normalizeLocale,
} from "../../shop/_components/shop-studio-theme";
import type { ExpenseListFilters, ExpenseListRow } from "../expenses-data";
import { ExpenseStatusBadge } from "./expense-status-badge";

export interface FilterOption {
  label: string;
  value: string;
}

interface ExpensesListProps {
  campusOptions: FilterOption[];
  /** The view shown when `?view=` is absent. */
  defaultView: ExpenseListFilters["view"];
  departmentOptions: FilterOption[];
  filters: ExpenseListFilters;
  rows: ExpenseListRow[];
  statusOptions: string[];
  total: number;
}

const VIEWS = ["all", "mine", "attention"] as const;
const COLUMNS = "0.6fr 1.3fr 1.1fr 0.9fr 0.8fr 1.1fr 1.2fr 0.7fr";

const SELECT_CLASS =
  "h-8 rounded-lg border bg-white/80 px-2.5 text-[12.5px] outline-none";

export function ExpensesList({
  campusOptions,
  defaultView,
  departmentOptions,
  filters,
  rows,
  statusOptions,
  total,
}: ExpensesListProps) {
  const t = useTranslations("adminPortal.expenses");
  const locale = normalizeLocale(useLocale());
  const { setParams } = useListParams();
  const [search, setSearch] = useUrlSearch();

  const setView = (view: ExpenseListFilters["view"]) =>
    setParams({ view: view === defaultView ? null : view });
  const setFilter = (key: string, value: string) =>
    setParams({ [key]: value || null });

  const emptyText =
    {
      attention: t("empty.attention"),
      mine: t("empty.mine"),
    }[filters.view as string] ?? t("empty.description");

  return (
    <>
      <div
        className="mt-6 flex gap-4"
        role="tablist"
        style={{ borderBottom: `0.5px solid ${STUDIO.rule}` }}
      >
        {VIEWS.map((view) => {
          const active = filters.view === view;
          return (
            <button
              aria-selected={active}
              className="pb-2 font-medium text-[14px]"
              key={view}
              onClick={() => setView(view)}
              role="tab"
              style={{
                borderBottom: `2px solid ${active ? STUDIO.ink : "transparent"}`,
                color: active ? STUDIO.ink : STUDIO.ink3,
              }}
              type="button"
            >
              {t(`views.${view}`)}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <SearchToolbar
          onSearch={setSearch}
          placeholder={t("search")}
          searchLabel={t("search")}
          value={search}
        />
        <select
          aria-label={t("filters.status")}
          className={SELECT_CLASS}
          onChange={(e) => setFilter("status", e.target.value)}
          style={{ borderColor: STUDIO.rule2 }}
          value={filters.status ?? ""}
        >
          <option value="">{t("filters.allStatuses")}</option>
          {statusOptions.map((status) => (
            <option key={status} value={status}>
              {t(`status.${status}`)}
            </option>
          ))}
        </select>
        {campusOptions.length > 1 && (
          <select
            aria-label={t("filters.campus")}
            className={SELECT_CLASS}
            onChange={(e) =>
              // A department belongs to one campus, so it cannot outlive it.
              setParams({ campus: e.target.value || null, department: null })
            }
            style={{ borderColor: STUDIO.rule2 }}
            value={filters.campusId ?? ""}
          >
            <option value="">{t("filters.allCampuses")}</option>
            {campusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        )}
        {filters.campusId && (
          <select
            aria-label={t("filters.department")}
            className={SELECT_CLASS}
            onChange={(e) => setFilter("department", e.target.value)}
            style={{ borderColor: STUDIO.rule2 }}
            value={filters.departmentId ?? ""}
          >
            <option value="">{t("filters.allDepartments")}</option>
            {departmentOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="mt-6">
          <EmptyState description={emptyText} title={t("empty.title")} />
        </div>
      ) : (
        <section className="mt-4 flex flex-col">
          <div
            className="grid gap-3 px-3.5 py-2.5 text-[11px] uppercase tracking-[0.05em]"
            style={{
              borderBottom: `0.5px solid ${STUDIO.rule}`,
              color: STUDIO.ink4,
              gridTemplateColumns: COLUMNS,
            }}
          >
            <div>{t("columns.reference")}</div>
            <div>{t("columns.submitter")}</div>
            <div>{t("columns.department")}</div>
            <div>{t("columns.campus")}</div>
            <div>{t("columns.total")}</div>
            <div>{t("columns.status")}</div>
            <div>{t("columns.waitingOn")}</div>
            <div>{t("columns.submitted")}</div>
          </div>
          {rows.map((row) => (
            <Link
              className="grid items-center gap-3 px-3.5 py-3 text-[13px] hover:bg-white/60"
              href={`/expenses/${row.id}`}
              key={row.id}
              style={{
                borderBottom: `0.5px solid ${STUDIO.rule}`,
                color: STUDIO.ink,
                gridTemplateColumns: COLUMNS,
              }}
            >
              <div style={{ fontFamily: MONO_STACK }}>{row.reference}</div>
              <div className="truncate">{row.submitterName}</div>
              <div className="truncate">{row.departmentName}</div>
              <div className="truncate">{row.campusName}</div>
              <div>{fmtNOK(row.total)}</div>
              <div className="flex flex-wrap items-center gap-1.5">
                <ExpenseStatusBadge status={row.status} />
                {row.flags.failed && (
                  <AlertTriangle
                    aria-label={t("flags.failed")}
                    role="img"
                    size={14}
                    style={{ color: STUDIO.claret }}
                  />
                )}
                {row.flags.approverIssue && (
                  <AlertTriangle
                    aria-label={t("flags.approverIssue")}
                    role="img"
                    size={14}
                    style={{ color: STUDIO.gold }}
                  />
                )}
                {row.flags.hints > 0 && (
                  <span
                    className="rounded-full px-1.5 text-[11px]"
                    style={{ background: STUDIO.paper3, color: STUDIO.ink3 }}
                    title={t("flags.hints", { count: row.flags.hints })}
                  >
                    {row.flags.hints}
                  </span>
                )}
              </div>
              <div className="truncate" style={{ color: STUDIO.ink3 }}>
                {row.currentStep
                  ? `${t(`roles.${row.currentStep.role}`)} · ${row.currentStep.approverEmail}`
                  : "—"}
              </div>
              <div style={{ color: STUDIO.ink3 }}>
                {fmtDate(row.submittedAt, locale)}
              </div>
            </Link>
          ))}
        </section>
      )}

      <PaginationBar
        page={filters.page}
        size={filters.size}
        sizeSelectable
        total={total}
      />
    </>
  );
}
