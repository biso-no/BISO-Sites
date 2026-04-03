"use client";

import type { CampusBenefit } from "@repo/api/types/appwrite";
import { BenefitStatus } from "@repo/api/types/appwrite";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import { Input } from "@repo/ui/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/ui/table";
import {
  Archive,
  CheckCircle,
  Copy,
  Edit,
  Gift,
  Globe,
  Search,
  Star,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  archiveBenefit,
  duplicateBenefit,
  publishBenefit,
} from "@/app/actions/benefits";
import { CAMPUS_ID_TO_NAME } from "@/lib/campus-constants";

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  published: {
    label: "Published",
    className:
      "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400",
  },
  draft: {
    label: "Draft",
    className:
      "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400",
  },
  archived: {
    label: "Archived",
    className: "bg-muted text-muted-foreground border-border",
  },
};

const KIND_STYLES: Record<string, string> = {
  offer: "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400",
  perk: "bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400",
  service: "bg-teal-100 text-teal-700 dark:bg-teal-900/20 dark:text-teal-400",
};

type BenefitsListClientProps = {
  benefits: CampusBenefit[];
  total: number;
};

export function BenefitsListClient({
  benefits: initial,
  total,
}: BenefitsListClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [activeActionId, setActiveActionId] = useState<string | null>(null);

  const filtered = initial.filter((b) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      b.title_en.toLowerCase().includes(q) ||
      b.title_nb.toLowerCase().includes(q) ||
      (b.partner_name ?? "").toLowerCase().includes(q) ||
      b.category.toLowerCase().includes(q);
    const matchesStatus = statusFilter === "all" || b.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const counts = {
    all: initial.length,
    published: initial.filter((b) => b.status === BenefitStatus.PUBLISHED)
      .length,
    draft: initial.filter((b) => b.status === BenefitStatus.DRAFT).length,
    archived: initial.filter((b) => b.status === BenefitStatus.ARCHIVED).length,
  };

  const handleAction = (id: string, fn: () => Promise<unknown>) => {
    setActiveActionId(id);
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } finally {
        setActiveActionId(null);
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {(["all", "published", "draft", "archived"] as const).map((status) => (
          <button
            className={`rounded-xl border p-4 text-left transition-all ${
              statusFilter === status
                ? "border-primary bg-primary/5 shadow-inner"
                : "border-border bg-card hover:border-primary/30"
            }`}
            id={`filter-${status}`}
            key={status}
            onClick={() => setStatusFilter(status)}
            type="button"
          >
            <p className="font-bold text-2xl">
              {counts[status as keyof typeof counts]}
            </p>
            <p className="text-muted-foreground text-sm capitalize">{status}</p>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-10"
          id="benefit-search"
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search benefits..."
          value={search}
        />
      </div>

      {/* Table */}
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            Benefits Catalog
          </CardTitle>
          <CardDescription>
            {filtered.length} of {total} benefits
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Benefit</TableHead>
                <TableHead>Campus</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    className="py-12 text-center text-muted-foreground"
                    colSpan={6}
                  >
                    No benefits found. Create your first benefit to get started.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((benefit) => {
                  const statusStyle =
                    STATUS_STYLES[benefit.status] ?? STATUS_STYLES.draft;
                  const isActive = activeActionId === benefit.$id;
                  return (
                    <TableRow
                      className={isActive ? "opacity-50" : ""}
                      key={benefit.$id}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {benefit.is_featured && (
                            <Star className="h-3.5 w-3.5 text-amber-500" />
                          )}
                          <div>
                            <p className="font-medium">{benefit.title_en}</p>
                            <p className="text-muted-foreground text-xs">
                              {benefit.title_nb}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1 text-sm">
                          {benefit.campus_id === "5" ? (
                            <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                          ) : null}
                          {CAMPUS_ID_TO_NAME[benefit.campus_id] ??
                            benefit.campus_id}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">
                        {benefit.category}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={KIND_STYLES[benefit.kind]}
                          variant="outline"
                        >
                          {benefit.kind}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={statusStyle.className}
                          variant="outline"
                        >
                          {statusStyle.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            className="h-7 w-7"
                            id={`edit-benefit-${benefit.$id}`}
                            onClick={() =>
                              router.push(`/membership/benefits/${benefit.$id}`)
                            }
                            size="icon"
                            title="Edit"
                            variant="ghost"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          {benefit.status !== BenefitStatus.PUBLISHED && (
                            <Button
                              className="h-7 w-7 text-emerald-600 hover:text-emerald-700"
                              disabled={isActive || isPending}
                              id={`publish-benefit-${benefit.$id}`}
                              onClick={() =>
                                handleAction(benefit.$id, () =>
                                  publishBenefit(benefit.$id)
                                )
                              }
                              size="icon"
                              title="Publish"
                              variant="ghost"
                            >
                              <CheckCircle className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {benefit.status !== BenefitStatus.ARCHIVED && (
                            <Button
                              className="h-7 w-7 text-muted-foreground"
                              disabled={isActive || isPending}
                              id={`archive-benefit-${benefit.$id}`}
                              onClick={() =>
                                handleAction(benefit.$id, () =>
                                  archiveBenefit(benefit.$id)
                                )
                              }
                              size="icon"
                              title="Archive"
                              variant="ghost"
                            >
                              <Archive className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button
                            className="h-7 w-7"
                            disabled={isActive || isPending}
                            id={`duplicate-benefit-${benefit.$id}`}
                            onClick={() =>
                              handleAction(benefit.$id, () =>
                                duplicateBenefit(benefit.$id)
                              )
                            }
                            size="icon"
                            title="Duplicate"
                            variant="ghost"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
