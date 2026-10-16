"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Pill } from "@/components/ui/pill";
import { removeIdentity } from "@/lib/actions/user";

interface Identity {
  $id: string;
  provider: string;
  providerUid?: string;
}

/**
 * How the account signs in — read-only apart from removing a secondary
 * identity. There is no "link" step any more: a BI student signs in with BI,
 * and that sign-in attaches the BI identity to the account by itself.
 */
export function IdentityManagement({
  initialIdentities,
}: {
  initialIdentities: Identity[] | undefined;
}) {
  const t = useTranslations("common.profile");
  const [identities, setIdentities] = useState<Identity[] | undefined>(
    initialIdentities
  );
  const [removingId, setRemovingId] = useState<string | null>(null);

  const canRemove = (id: Identity) => {
    const provider = (id.provider || "").toLowerCase();
    // Keep core email/magic-url intact to avoid locking user out. The BI
    // identity is how a student signs in and what backs their membership;
    // there is nothing to gain from removing it and no way to add it back
    // except signing in with BI again.
    if (
      provider === "email" ||
      provider === "magic-url" ||
      provider === "magicurl" ||
      provider === "oidc"
    ) {
      return false;
    }
    // Avoid removing the last remaining identity
    if ((identities?.length || 0) <= 1) {
      return false;
    }
    return true;
  };

  const providerLabel = (p: string) => {
    const key = (p || "").toLowerCase();
    if (key === "microsoft") {
      return "BISO";
    }
    if (key === "oidc") {
      return "BI Student";
    }
    if (key === "email") {
      return t("identities.providerEmail");
    }
    if (key === "magic-url" || key === "magicurl") {
      return t("identities.providerLoginLink");
    }
    return p;
  };

  const onRemove = async (identity: Identity) => {
    if (!canRemove(identity)) {
      return;
    }
    setRemovingId(identity.$id);
    try {
      const res = await removeIdentity(identity.$id);
      if (res?.success) {
        setIdentities((prev) =>
          (prev || []).filter((i) => i.$id !== identity.$id)
        );
        toast.success(t("identities.removed"));
      } else {
        toast.error(t("identities.removeFailed"), {
          description: String(res?.error || t("identities.unknownError")),
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(t("identities.removeFailed"), {
        description: message,
      });
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <section className="rounded-biso-md border border-edge p-6">
      <h2 className="type-heading-card text-ink">{t("identities.title")}</h2>
      <p className="type-body-sm mt-1 mb-6 text-ink-muted">
        {t("identities.signInBody")}
      </p>

      {(identities?.length || 0) === 0 ? (
        <p className="type-body-sm text-ink-muted">{t("identities.empty")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {identities?.map((id) => (
            <li
              className="flex flex-wrap items-center justify-between gap-3 rounded-biso-md border border-edge px-4 py-3"
              key={id.$id}
            >
              <div className="flex min-w-0 items-center gap-3">
                <Pill tone="accent">{providerLabel(id.provider)}</Pill>
                <span
                  className="type-body-sm max-w-[28ch] truncate text-ink-muted"
                  title={id.providerUid || id.$id}
                >
                  {id.providerUid || id.$id}
                </span>
              </div>
              {canRemove(id) ? (
                <button
                  className="type-label inline-flex items-center gap-1.5 rounded-biso-pill px-3 py-2 text-danger transition-colors hover:bg-danger/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-60"
                  disabled={removingId === id.$id}
                  onClick={() => onRemove(id)}
                  type="button"
                >
                  <Trash2 aria-hidden="true" className="size-4 shrink-0" />
                  {t("identities.remove")}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
