"use client";

import { useState } from "react";
import { messageSegment } from "../../../../_actions/event-segments";
import type { MessageSegmentValues } from "../../../../_actions/schemas";
import { PortalButton } from "../../../../_components/portal-button";
import {
  PortalField,
  PortalInput,
  PortalTextarea,
} from "../../../../_components/portal-fields";
import { STUDIO } from "../../../../_components/studio";

interface MessageComposerProps {
  onClose: () => void;
  onSent: (recipients?: number) => void;
  segmentId: string;
  segmentName: string;
}

export function MessageComposer({
  onClose,
  onSent,
  segmentId,
  segmentName,
}: MessageComposerProps) {
  const [titleEn, setTitleEn] = useState("");
  const [titleNo, setTitleNo] = useState("");
  const [bodyEn, setBodyEn] = useState("");
  const [bodyNo, setBodyNo] = useState("");
  const [push, setPush] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async () => {
    if (!titleEn.trim()) {
      setError("Title (EN) is required");
      return;
    }
    setSending(true);
    setError(null);
    const content: MessageSegmentValues = {
      title_en: titleEn,
      title_no: titleNo || null,
      body_en: bodyEn || null,
      body_no: bodyNo || null,
      category: "trip",
      push,
    };
    const result = await messageSegment(segmentId, content);
    setSending(false);
    if (typeof result.error === "string") {
      setError(result.error);
      return;
    }
    if (result.error) {
      setError("Please check the message fields.");
      return;
    }
    onSent();
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm" style={{ color: STUDIO.ink3 }}>
        Message everyone assigned to{" "}
        <span style={{ color: STUDIO.ink }}>{segmentName}</span>.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <PortalField label="Title (EN)" required>
          <PortalInput
            onChange={(e) => setTitleEn(e.target.value)}
            value={titleEn}
          />
        </PortalField>
        <PortalField label="Title (NO)">
          <PortalInput
            onChange={(e) => setTitleNo(e.target.value)}
            value={titleNo}
          />
        </PortalField>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <PortalField label="Body (EN)">
          <PortalTextarea
            onChange={(e) => setBodyEn(e.target.value)}
            rows={3}
            value={bodyEn}
          />
        </PortalField>
        <PortalField label="Body (NO)">
          <PortalTextarea
            onChange={(e) => setBodyNo(e.target.value)}
            rows={3}
            value={bodyNo}
          />
        </PortalField>
      </div>

      <label
        className="flex items-center gap-2 text-sm"
        style={{ color: STUDIO.ink2 }}
      >
        <input
          checked={push}
          onChange={(e) => setPush(e.target.checked)}
          type="checkbox"
        />
        Send push notification
      </label>

      {error && (
        <p className="text-xs" style={{ color: STUDIO.claret }}>
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-2">
        <PortalButton onClick={onClose} variant="ghost">
          Cancel
        </PortalButton>
        <PortalButton loading={sending} onClick={handleSend} variant="primary">
          Send message
        </PortalButton>
      </div>
    </div>
  );
}
