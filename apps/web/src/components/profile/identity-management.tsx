"use client";

import { clientAccount, OAuthProvider } from "@repo/api/client";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import { Link2, Trash2 } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
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
  const [isLinking, startLinkTransition] = useTransition();
  const [removingId, setRemovingId] = useState<string | null>(null);

  const canRemove = (id: Identity) => {
    const provider = (id.provider || "").toLowerCase();
    // Keep core email/magic-url intact to avoid locking user out
    if (
      provider === "email" ||
      provider === "magic-url" ||
      provider === "magicurl"
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

  const failureUrl = useMemo(() => {
    if (typeof window === "undefined") {
      return "";
    }
    return `${window.location.origin}/profile?error=oauth_failed`;
  }, []);

  const linkProvider = (provider: OAuthProvider) => {
    startLinkTransition(async () => {
      try {
        const base = window.location.origin;
        // Only the OIDC (BI Student) provider needs the BI sync: its success
        // URL routes through /api/auth/bi-link, which runs the sync + cache
        // invalidation outside the render path and only then redirects back
        // here — see that route's doc comment for why. Other providers
        // (Microsoft/BISO) don't touch BI identity fields, so they go
        // straight back to /profile.
        const successUrl =
          provider === OAuthProvider.Oidc
            ? `${base}/api/auth/bi-link?returnTo=/profile`
            : `${base}/profile?linked=1`;
        await clientAccount.createOAuth2Session(
          provider,
          successUrl,
          failureUrl,
          ["openid", "email", "profile"]
        );
        // Browser will redirect; no-op here
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        toast.error(`Linking failed: ${message}`);
      }
    });
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
          <CardTitle>Linked Accounts</CardTitle>
          <CardDescription>
            Link your BISO account and your BI Student account. Linking your BI
            Student account lets us verify your paid semester membership for
            benefits and discounts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              className="rounded-lg"
              disabled={isLinking}
              onClick={() => linkProvider(OAuthProvider.Microsoft)}
            >
              <Link2 className="mr-2 h-4 w-4" /> Link BISO
            </Button>
            <Button
              className="rounded-lg"
              disabled={isLinking}
              onClick={() => linkProvider(OAuthProvider.Oidc)}
              variant="outline"
            >
              <Link2 className="mr-2 h-4 w-4" /> Link BI Student
            </Button>
          </div>
          <p className="text-primary-60 text-xs">
            When linking, you will be redirected to complete the OAuth flow.
          </p>
        </CardContent>
      </Card>

      <Card className="border border-primary/10">
        <CardHeader>
          <CardTitle>Connected Identities</CardTitle>
          <CardDescription>
            Accounts currently connected to your profile
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
