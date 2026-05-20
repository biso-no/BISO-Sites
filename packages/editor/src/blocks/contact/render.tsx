"use client";

import type { PatchFn } from "@/blocks/types";
import type { ContactBlock } from "@/editor/types";

interface Props {
  block: ContactBlock;
  edit: boolean;
  onPatch: PatchFn;
}

function E({
  children,
  onBlur,
}: {
  children: string;
  onBlur: (v: string) => void;
}) {
  return (
    <span
      contentEditable
      data-edit="1"
      onBlur={(e) => onBlur(e.currentTarget.textContent ?? "")}
      suppressContentEditableWarning
    >
      {children}
    </span>
  );
}

export function ContactRender({ block, edit, onPatch }: Props) {
  return (
    <div
      className={`pg-contact pg-contact--${block.variant ?? "single"} pg-block`}
    >
      {edit ? (
        <h2
          contentEditable
          data-edit="1"
          onBlur={(e) => onPatch("heading", e.currentTarget.textContent ?? "")}
          suppressContentEditableWarning
        >
          {block.heading}
        </h2>
      ) : (
        <h2>{block.heading}</h2>
      )}
      <div className="pg-contact__col">
        <div className="pg-contact__col-label">Email</div>
        <div className="pg-contact__col-val">
          {edit ? (
            <E onBlur={(v) => onPatch("email", v)}>{block.email}</E>
          ) : (
            <a href={`mailto:${block.email}`}>{block.email}</a>
          )}
        </div>
      </div>
      <div className="pg-contact__col">
        <div className="pg-contact__col-label">Instagram</div>
        <div className="pg-contact__col-val">
          {edit ? (
            <E onBlur={(v) => onPatch("instagram", v)}>{block.instagram}</E>
          ) : (
            <span>{block.instagram}</span>
          )}
        </div>
      </div>
      <div className="pg-contact__col">
        <div className="pg-contact__col-label">Address</div>
        <div className="pg-contact__col-val">
          {edit ? (
            <E onBlur={(v) => onPatch("address", v)}>{block.address}</E>
          ) : (
            <span>{block.address}</span>
          )}
        </div>
        <div
          style={{ marginTop: 6, color: "rgba(250,247,242,.55)", fontSize: 12 }}
        >
          {edit ? (
            <E onBlur={(v) => onPatch("hours", v)}>{block.hours}</E>
          ) : (
            <span>{block.hours}</span>
          )}
        </div>
      </div>
      {block.variant === "directory" &&
        (block.members ?? []).map((m, i) => (
          <div className="pg-contact__col" key={i}>
            <div className="pg-contact__col-label">{m.role}</div>
            <div className="pg-contact__col-val">{m.name}</div>
            {m.email && (
              <div
                style={{
                  marginTop: 4,
                  fontSize: 12,
                  color: "rgba(250,247,242,.55)",
                }}
              >
                <a href={`mailto:${m.email}`} style={{ color: "inherit" }}>
                  {m.email}
                </a>
              </div>
            )}
            {m.phone && (
              <div
                style={{
                  marginTop: 2,
                  fontSize: 12,
                  color: "rgba(250,247,242,.55)",
                }}
              >
                {m.phone}
              </div>
            )}
          </div>
        ))}
    </div>
  );
}
