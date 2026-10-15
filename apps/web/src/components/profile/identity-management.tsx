"use client";

import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { removeIdentity } from "@/lib/actions/user";

interface Identity {
  $id: string;
  provider: string;
  providerUid?: string;
}

export function IdentityManagement({
  initialIdentities,
}: {
  initialIdentities: Identity[] | undefined;
}) {
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
      return "Email";
    }
    if (key === "magic-url" || key === "magicurl") {
      return "Magic URL";
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
        toast.success("Identity removed");
      } else {
        toast.error("Failed to remove", {
          description: String(res?.error || "Unknown error"),
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error("Failed to remove", {
        description: message,
      });
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border border-primary/10">
        <CardHeader>
          <CardTitle>Connected Identities</CardTitle>
          <CardDescription>
            How you sign in. Your BI Student identity is what verifies your
            membership; sign in with BI to add it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(identities?.length || 0) === 0 ? (
            <div className="text-primary-60 text-sm">
              No identities linked yet.
            </div>
          ) : (
            identities?.map((id) => (
              <div
                className="flex items-center justify-between rounded-lg border border-primary/10 bg-background px-3 py-2"
                key={id.$id}
              >
                <div className="flex items-center gap-3">
                  <Badge variant="secondary">
                    {providerLabel(id.provider)}
                  </Badge>
                  <div
                    className="max-w-[28ch] truncate text-primary-80 text-sm"
                    title={id.providerUid || id.$id}
                  >
                    {id.providerUid || id.$id}
                  </div>
                </div>
                <Button
                  className="text-red-600 hover:bg-red-50"
                  disabled={!canRemove(id) || removingId === id.$id}
                  onClick={() => onRemove(id)}
                  size="sm"
                  variant="ghost"
                >
                  <Trash2 className="mr-1 h-4 w-4" /> Remove
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
