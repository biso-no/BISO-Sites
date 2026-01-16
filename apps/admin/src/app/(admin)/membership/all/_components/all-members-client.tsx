"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@repo/ui/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@repo/ui/components/ui/table";
import { Badge } from "@repo/ui/components/ui/badge";
import { Progress } from "@repo/ui/components/ui/progress";
import { cn } from "@repo/ui/lib/utils";
import { Search, Users, CreditCard, Calendar, RefreshCw, Loader2, StopCircle } from "lucide-react";
import type { MemberInfo, SyncState } from "@/app/actions/all-members";
import { syncAllMembers, getSyncStatus, stopSync } from "@/app/actions/all-members";
import { useDebouncedCallback } from "use-debounce";

interface AllMembersClientProps {
    members: MemberInfo[];
    totalCount: number;
    activeMembershipCount: number;
    lastSynced: string | null;
}

const DATE_FORMATTER = new Intl.DateTimeFormat("nb-NO", {
    day: "numeric",
    month: "short",
    year: "numeric",
});

const SYNC_FORMATTER = new Intl.DateTimeFormat("nb-NO", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
});

export function AllMembersClient({
    members,
    totalCount,
    activeMembershipCount,
    lastSynced,
}: AllMembersClientProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    // UI states
    const [isStartingSync, startTransition] = useTransition();
    const [isStopping, startStopping] = useTransition();
    const [syncState, setSyncState] = useState<SyncState | null>(null);

    // Poll for sync status
    useEffect(() => {
        let intervalId: NodeJS.Timeout;

        const checkStatus = async () => {
            const status = await getSyncStatus();
            setSyncState(status);

            // If running or stopping, keep polling
            // If just finished (success/error/idle), we might want to poll a few more times to update UI then stop
            // For simplicity, we poll if status is running/stopping
            if (status && (status.status === "running" || status.status === "stopping")) {
                // Should continue polling 
            } else if (status?.status === "success" && syncState?.status === "running") {
                // Transitioned to success, refresh page
                router.refresh();
            }
        };

        // Initial check
        checkStatus();

        // Start polling interval
        intervalId = setInterval(checkStatus, 2000);

        return () => clearInterval(intervalId);
    }, [router, syncState?.status]); // Re-bind if status changes to handle logic

    // Search handler
    const handleSearch = useDebouncedCallback((term: string) => {
        const params = new URLSearchParams(searchParams);
        if (term) {
            params.set("search", term);
            params.set("page", "1"); // Reset to page 1
        } else {
            params.delete("search");
        }
        router.replace(`${pathname}?${params.toString()}`);
    }, 500);

    // Start Sync handler
    const handleSync = () => {
        startTransition(async () => {
            // Optimistic update
            setSyncState({
                job_id: "member_sync",
                status: "running",
                progress_current: 0,
                progress_total: 100, // placeholder
                message: "Starting sync...",
                updated_at: new Date().toISOString()
            });

            const result = await syncAllMembers();
            if (result.success) {
                router.refresh();
            } else {
                console.error("Sync failed:", result.error);
            }
        });
    };

    // Stop Sync handler
    const handleStop = () => {
        startStopping(async () => {
            await stopSync();
            // UI will update on next poll
        });
    };

    const isRunning = syncState?.status === "running" || syncState?.status === "stopping";
    const progressPercent = syncState?.progress_total
        ? Math.round((syncState.progress_current / syncState.progress_total) * 100)
        : 0;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-end">
                {/* Stats Cards */}
                <div className="grid gap-4 md:grid-cols-2 flex-1 mr-4">
                    <Card className="glass-panel">
                        <CardHeader className="pb-2">
                            <CardDescription>Total Active Members</CardDescription>
                            <CardTitle className="text-3xl flex items-center gap-2">
                                <Users className="h-6 w-6 text-primary" />
                                {totalCount}
                            </CardTitle>
                        </CardHeader>
                    </Card>

                    <Card className="glass-panel">
                        <CardHeader className="pb-2">
                            <CardDescription>Membership Types Active</CardDescription>
                            <CardTitle className="text-3xl flex items-center gap-2">
                                <CreditCard className="h-6 w-6 text-emerald-500" />
                                {activeMembershipCount}
                            </CardTitle>
                        </CardHeader>
                    </Card>
                </div>

                <div className="flex flex-col items-end gap-2 pb-1 min-w-[200px]">
                    <p className="text-xs text-muted-foreground">
                        Last synced: {lastSynced ? SYNC_FORMATTER.format(new Date(lastSynced)) : "Never"}
                    </p>

                    {isRunning ? (
                        <Button
                            onClick={handleStop}
                            disabled={isStopping || syncState?.status === "stopping"}
                            variant="destructive"
                            className="gap-2 w-full"
                        >
                            {isStopping || syncState?.status === "stopping" ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <StopCircle className="h-4 w-4" />
                            )}
                            {syncState?.status === "stopping" ? "Stopping..." : "Stop Sync"}
                        </Button>
                    ) : (
                        <Button
                            onClick={handleSync}
                            disabled={isStartingSync}
                            variant="outline"
                            className="gap-2 w-full"
                        >
                            {isStartingSync ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <RefreshCw className="h-4 w-4" />
                            )}
                            Sync from 24SevenOffice
                        </Button>
                    )}
                </div>
            </div>

            {/* Sync Progress Bar */}
            {isRunning && (
                <Card className="border-blue-500/20 bg-blue-500/5">
                    <CardContent className="pt-6">
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="font-medium text-blue-600 dark:text-blue-400">
                                    {syncState?.status === "stopping" ? "Stopping..." : "Syncing..."}
                                </span>
                                <span className="text-muted-foreground">{progressPercent}%</span>
                            </div>
                            <Progress value={progressPercent} className="h-2" />
                            <p className="text-xs text-muted-foreground h-4">
                                {syncState?.message}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Search */}
            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search by name or student ID..."
                    defaultValue={searchParams.get("search")?.toString()}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="pl-10"
                />
            </div>

            {/* Members Table */}
            <Card className="glass-panel">
                <CardHeader>
                    <CardTitle>Member Directory</CardTitle>
                    <CardDescription>
                        {totalCount} active members found
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Student ID</TableHead>
                                <TableHead>Company ID</TableHead>
                                <TableHead>Membership(s)</TableHead>
                                <TableHead>Expires</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {members.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                                        No members found. Try running a sync or changing your search.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                members.map((member) => (
                                    <TableRow key={member.companyId}>
                                        <TableCell className="font-medium">{member.name}</TableCell>
                                        <TableCell>
                                            {member.externalId ? (
                                                <code className="text-sm bg-muted px-1.5 py-0.5 rounded">
                                                    {member.externalId}
                                                </code>
                                            ) : (
                                                <span className="text-muted-foreground">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {member.companyId}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap gap-1">
                                                {member.memberships.map((mem) => (
                                                    <Badge
                                                        key={mem.id}
                                                        variant="outline"
                                                        className="text-xs"
                                                    >
                                                        {mem.name}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                                <Calendar className="h-3 w-3" />
                                                {member.memberships.length > 0 &&
                                                    DATE_FORMATTER.format(
                                                        new Date(
                                                            Math.max(
                                                                ...member.memberships.map((m) =>
                                                                    new Date(m.expiryDate).getTime()
                                                                )
                                                            )
                                                        )
                                                    )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
