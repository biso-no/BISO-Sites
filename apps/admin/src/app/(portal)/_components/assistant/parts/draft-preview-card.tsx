"use client";

import { CheckCircle, Edit3, X } from "lucide-react";
import { useState } from "react";
import { MONO_STACK, STUDIO } from "../../studio";

export interface BilingualDraft {
  descriptionEN: string;
  descriptionNO: string;
  meta?: Record<string, string>;
  titleEN: string;
  titleNO: string;
}

interface DraftPreviewCardProps {
  descriptionEN: string;
  descriptionNO: string;
  domain: string;
  meta?: Record<string, string>;
  onApprove: (edited: BilingualDraft) => void;
  onCancel: () => void;
  /** If provided, show approved/cancelled state */
  result?: { approved: boolean };
  titleEN: string;
  titleNO: string;
}

type Lang = "no" | "en";

export function DraftPreviewCard({
  descriptionEN,
  descriptionNO,
  domain,
  meta,
  onApprove,
  onCancel,
  result,
  titleEN,
  titleNO,
}: DraftPreviewCardProps) {
  const [lang, setLang] = useState<Lang>("no");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<BilingualDraft>({
    titleNO,
    titleEN,
    descriptionNO,
    descriptionEN,
    meta,
  });

  if (result !== undefined) {
    return (
      <div
        className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs"
        style={{
          background: result.approved
            ? "rgba(47,93,58,0.08)"
            : "rgba(26,24,20,0.05)",
          borderColor: result.approved ? "rgba(47,93,58,0.18)" : STUDIO.rule2,
          color: result.approved ? STUDIO.leaf : STUDIO.ink3,
          fontFamily: MONO_STACK,
        }}
      >
        {result.approved ? (
          <>
            <CheckCircle size={11} /> Draft approved
          </>
        ) : (
          <>Draft cancelled</>
        )}
      </div>
    );
  }

  const currentTitle = lang === "no" ? draft.titleNO : draft.titleEN;
  const currentDesc = lang === "no" ? draft.descriptionNO : draft.descriptionEN;

  function updateTitle(value: string) {
    setDraft((d) =>
      lang === "no" ? { ...d, titleNO: value } : { ...d, titleEN: value }
    );
  }

  function updateDesc(value: string) {
    setDraft((d) =>
      lang === "no"
        ? { ...d, descriptionNO: value }
        : { ...d, descriptionEN: value }
    );
  }

  return (
    <div
      className="mt-2 w-full rounded-xl border"
      style={{
        background: "rgba(255,255,255,0.82)",
        borderColor: STUDIO.rule2,
        boxShadow: "0 4px 16px rgba(26,24,20,0.08)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between border-b px-4 py-3"
        style={{ borderColor: STUDIO.rule }}
      >
        <div className="flex items-center gap-2">
          <span
            className="font-semibold text-[10px] uppercase tracking-wide"
            style={{ color: STUDIO.ink4, fontFamily: MONO_STACK }}
          >
            Draft • {domain}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            className="rounded-md px-2.5 py-0.5 text-[11px] transition"
            onClick={() => setEditing((e) => !e)}
            style={{
              background: editing ? STUDIO.paper3 : "transparent",
              color: STUDIO.ink3,
            }}
            type="button"
          >
            <Edit3 className="mr-1 inline" size={11} />
            {editing ? "Done editing" : "Edit"}
          </button>
        </div>
      </div>

      {/* Language tabs */}
      <div
        className="flex gap-0.5 border-b px-4 pt-2"
        style={{ borderColor: STUDIO.rule }}
      >
        {(["no", "en"] as const).map((l) => (
          <button
            className="rounded-t-md px-3 py-1.5 font-medium text-[11px] transition"
            key={l}
            onClick={() => setLang(l)}
            style={{
              background: lang === l ? STUDIO.paper2 : "transparent",
              borderBottom:
                lang === l
                  ? `2px solid ${STUDIO.ink}`
                  : "2px solid transparent",
              color: lang === l ? STUDIO.ink : STUDIO.ink4,
              fontFamily: MONO_STACK,
            }}
            type="button"
          >
            {l === "no" ? "🇳🇴 NO" : "🇬🇧 EN"}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="px-4 py-3">
        {editing ? (
          <>
            <input
              className="mb-2 w-full rounded-lg border px-3 py-1.5 text-[14px] outline-none"
              onChange={(e) => updateTitle(e.target.value)}
              style={{
                background: STUDIO.paper,
                borderColor: STUDIO.rule2,
                color: STUDIO.ink,
              }}
              value={currentTitle}
            />
            <textarea
              className="w-full resize-none rounded-lg border px-3 py-2 text-[13px] outline-none"
              onChange={(e) => updateDesc(e.target.value)}
              rows={6}
              style={{
                background: STUDIO.paper,
                borderColor: STUDIO.rule2,
                color: STUDIO.ink,
              }}
              value={currentDesc}
            />
          </>
        ) : (
          <>
            <p
              className="mb-1 font-semibold text-[15px]"
              style={{ color: STUDIO.ink }}
            >
              {currentTitle}
            </p>
            <p
              className="whitespace-pre-line text-[13px] leading-5"
              style={{ color: STUDIO.ink2 }}
            >
              {currentDesc.length > 300
                ? `${currentDesc.slice(0, 300)}…`
                : currentDesc}
            </p>
          </>
        )}

        {/* Meta */}
        {draft.meta && Object.keys(draft.meta).length > 0 && (
          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1">
            {Object.entries(draft.meta).map(([k, v]) => (
              <div key={k}>
                <dt
                  className="text-[10px] uppercase tracking-wide"
                  style={{ color: STUDIO.ink4, fontFamily: MONO_STACK }}
                >
                  {k}
                </dt>
                <dd
                  className="truncate text-[12px]"
                  style={{ color: STUDIO.ink2 }}
                >
                  {v}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      {/* Actions */}
      <div
        className="flex gap-2 border-t px-4 py-3"
        style={{ borderColor: STUDIO.rule }}
      >
        <button
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 font-medium text-xs transition"
          onClick={() => onApprove(draft)}
          style={{
            background: STUDIO.ink,
            color: STUDIO.paper,
          }}
          type="button"
        >
          <CheckCircle size={12} />
          Approve & save
        </button>
        <button
          className="rounded-lg px-3 py-2 text-xs transition"
          onClick={onCancel}
          style={{
            background: "rgba(26,24,20,0.06)",
            color: STUDIO.ink3,
          }}
          type="button"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
}
