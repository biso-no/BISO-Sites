"use client";

import Link from "next/link";
import { useState } from "react";
import { STUDIO, studioSurface } from "../../../../_components/studio";

export interface AiEvalWindow {
  kept: number;
  keptRate: number | null;
  perType: {
    /** `to` is null for an own text. */
    correctedTo: { count: number; to: string | null }[];
    kept: number;
    label: string;
    slug: string;
    total: number;
  }[];
  total: number;
}

export interface AiEvalLabels {
  /** Already filled in with the cap. */
  capped: string;
  changedTo: string;
  keptRate: string;
  makeType: string;
  noData: string;
  none: string;
  overall: string;
  /** Contains `{kept}` and `{total}`. */
  overallCount: string;
  ownText: string;
  perTypeTitle: string;
  picks: string;
  recurringEmpty: string;
  recurringHint: string;
  recurringTitle: string;
  /** Contains `{count}`. */
  times: string;
  type: string;
  window30: string;
  window90: string;
}

type Days = 30 | 90;

const percent = (rate: number | null): string =>
  rate === null ? "–" : `${Math.round(rate * 100)} %`;

export function AiEvalClient({
  capped,
  labels,
  recurring,
  windows,
}: {
  capped: boolean;
  labels: AiEvalLabels;
  recurring: { count: number; example: string; text: string }[];
  windows: Record<Days, AiEvalWindow>;
}) {
  const [days, setDays] = useState<Days>(30);
  const stats = windows[days];

  return (
    <div className="space-y-6">
      <section className="rounded-2xl p-5" style={studioSurface}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[12px]" style={{ color: STUDIO.ink4 }}>
              {labels.overall}
            </p>
            <p className="font-medium text-2xl" style={{ color: STUDIO.ink }}>
              {percent(stats.keptRate)}
            </p>
            <p className="text-[12px]" style={{ color: STUDIO.ink4 }}>
              {labels.overallCount
                .replace("{kept}", String(stats.kept))
                .replace("{total}", String(stats.total))}
            </p>
          </div>
          <div className="flex gap-1">
            {([30, 90] as const).map((value) => (
              <button
                aria-pressed={days === value}
                key={value}
                onClick={() => setDays(value)}
                style={{
                  background: days === value ? STUDIO.ink : STUDIO.white,
                  border: `0.5px solid ${STUDIO.rule2}`,
                  borderRadius: 8,
                  color: days === value ? STUDIO.white : STUDIO.ink,
                  fontSize: 13,
                  padding: "6px 14px",
                }}
                type="button"
              >
                {value === 30 ? labels.window30 : labels.window90}
              </button>
            ))}
          </div>
        </div>
        {capped && (
          <p className="mt-3 text-[12px]" style={{ color: STUDIO.ink4 }}>
            {labels.capped}
          </p>
        )}
      </section>

      <section className="rounded-2xl p-5" style={studioSurface}>
        <h2 className="font-medium text-[15px]">{labels.perTypeTitle}</h2>
        {stats.perType.length === 0 ? (
          <p className="mt-3 text-[13px]" style={{ color: STUDIO.ink4 }}>
            {labels.noData}
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="text-[12px]" style={{ color: STUDIO.ink4 }}>
                  <th className="pb-2 font-normal">{labels.type}</th>
                  <th className="pb-2 font-normal">{labels.picks}</th>
                  <th className="pb-2 font-normal">{labels.keptRate}</th>
                  <th className="pb-2 font-normal">{labels.changedTo}</th>
                </tr>
              </thead>
              <tbody>
                {stats.perType.map((type) => (
                  <tr
                    key={type.slug}
                    style={{ borderTop: `0.5px solid ${STUDIO.rule}` }}
                  >
                    <td className="py-2 pr-3">{type.label}</td>
                    <td className="py-2 pr-3">{type.total}</td>
                    <td className="py-2 pr-3">
                      {percent(type.kept / type.total)}
                    </td>
                    <td className="py-2">
                      {type.correctedTo.length === 0
                        ? labels.none
                        : type.correctedTo
                            .map(
                              (entry) =>
                                `${entry.to ?? labels.ownText} (${entry.count})`
                            )
                            .join(", ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl p-5" style={studioSurface}>
        <h2 className="font-medium text-[15px]">{labels.recurringTitle}</h2>
        <p className="mt-1 text-[13px]" style={{ color: STUDIO.ink4 }}>
          {labels.recurringHint}
        </p>
        {recurring.length === 0 ? (
          <p className="mt-3 text-[13px]" style={{ color: STUDIO.ink4 }}>
            {labels.recurringEmpty}
          </p>
        ) : (
          <ul className="mt-3">
            {recurring.map((item) => (
              <li
                className="flex items-center justify-between gap-3 py-2 text-[13px]"
                key={item.text}
                style={{ borderTop: `0.5px solid ${STUDIO.rule}` }}
              >
                <span>
                  {item.example}
                  <span className="ml-2" style={{ color: STUDIO.ink4 }}>
                    {labels.times.replace("{count}", String(item.count))}
                  </span>
                </span>
                <Link
                  href={`/expenses/settings?newType=${encodeURIComponent(item.example)}`}
                  style={{
                    background: STUDIO.white,
                    border: `0.5px solid ${STUDIO.rule2}`,
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 500,
                    padding: "6px 14px",
                  }}
                >
                  {labels.makeType}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
