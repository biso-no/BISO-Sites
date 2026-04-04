"use client";

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@repo/ui/components/ui/alert";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/ui/table";
import { AlertCircle, CheckCircle2, Loader2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { apiClient } from "@/lib/api-client";

interface TurnoverRow {
  ensureShared: boolean;
  id: string;
  incomingUserUpn: string;
  roleMailboxUpn: string;
}

interface TurnoverResult {
  dryRun: boolean;
  error?: string;
  incomingUserUpn: string;
  index: number;
  roleMailboxUpn: string;
  success: boolean;
}

interface BulkTurnoverResult {
  results: TurnoverResult[];
  totalFailed: number;
  totalRequested: number;
  totalSucceeded: number;
}

export function BulkTurnoverForm() {
  const [rows, setRows] = useState<TurnoverRow[]>([createEmptyRow()]);
  const [dryRunAll, setDryRunAll] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<BulkTurnoverResult | null>(null);

  function createEmptyRow(): TurnoverRow {
    return {
      id: crypto.randomUUID(),
      roleMailboxUpn: "",
      incomingUserUpn: "",
      ensureShared: true,
    };
  }

  function addRow() {
    setRows([...rows, createEmptyRow()]);
  }

  function removeRow(id: string) {
    if (rows.length === 1) {
      return;
    }
    setRows(rows.filter((r) => r.id !== id));
  }

  function updateRow(
    id: string,
    field: keyof TurnoverRow,
    value: string | boolean
  ) {
    setRows(rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  async function handleSubmit() {
    setIsSubmitting(true);
    setResult(null);

    const payload = {
      operations: rows.map((r) => ({
        roleMailboxUpn: r.roleMailboxUpn,
        incomingUserUpn: r.incomingUserUpn,
        ensureShared: r.ensureShared,
        dryRun: false, // Individual dry run flag
      })),
      dryRunAll,
    };

    try {
      const data = await apiClient.fetch<BulkTurnoverResult>(
        "/api/admin/account-turnover/bulk",
        {
          method: "POST",
          body: payload,
        }
      );

      setResult(data);
    } catch (error: any) {
      console.error("Bulk turnover failed:", error);
    } finally {
      setIsSubmitting(false);
    }
  }

  const isValid = rows.every((r) => r.roleMailboxUpn && r.incomingUserUpn);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Bulk Account Turnover</CardTitle>
        <CardDescription>
          Transfer mailbox access from role accounts to incoming users. Use Dry
          Run mode to preview changes without applying them.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {result && (
          <Alert variant={result.totalFailed > 0 ? "destructive" : "default"}>
            {result.totalFailed > 0 ? (
              <AlertCircle className="h-4 w-4" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            <AlertTitle>
              {dryRunAll ? "[DRY RUN] " : ""}
              {result.totalSucceeded} of {result.totalRequested} turnovers
              {dryRunAll ? " validated" : " completed"}
            </AlertTitle>
            <AlertDescription>
              {result.totalFailed > 0 && (
                <div className="mt-2">
                  <p className="font-medium">Failed operations:</p>
                  <ul className="list-disc pl-4 text-sm">
                    {result.results
                      .filter((r) => !r.success)
                      .map((r) => (
                        <li key={r.index}>
                          {r.roleMailboxUpn} → {r.incomingUserUpn}: {r.error}
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Results Table */}
        {result && (
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role Mailbox</TableHead>
                  <TableHead>Incoming User</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.results.map((r) => (
                  <TableRow key={r.index}>
                    <TableCell className="font-mono text-sm">
                      {r.roleMailboxUpn}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {r.incomingUserUpn}
                    </TableCell>
                    <TableCell>
                      {r.success ? (
                        <Badge className="text-green-600" variant="outline">
                          {r.dryRun ? "Valid" : "Success"}
                        </Badge>
                      ) : (
                        <Badge variant="destructive">{r.error}</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Input Table */}
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role Mailbox UPN</TableHead>
                <TableHead>Incoming User UPN</TableHead>
                <TableHead className="text-center">Convert to Shared</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Input
                      onChange={(e) =>
                        updateRow(row.id, "roleMailboxUpn", e.target.value)
                      }
                      placeholder="role.account@biso.no"
                      type="email"
                      value={row.roleMailboxUpn}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      onChange={(e) =>
                        updateRow(row.id, "incomingUserUpn", e.target.value)
                      }
                      placeholder="new.user@biso.no"
                      type="email"
                      value={row.incomingUserUpn}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={row.ensureShared}
                      onCheckedChange={(checked) =>
                        updateRow(row.id, "ensureShared", !!checked)
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      disabled={rows.length === 1}
                      onClick={() => removeRow(row.id)}
                      size="icon"
                      variant="ghost"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            checked={dryRunAll}
            id="dryRun"
            onCheckedChange={(checked) => setDryRunAll(!!checked)}
          />
          <Label className="cursor-pointer" htmlFor="dryRun">
            Dry Run Mode (preview changes without applying)
          </Label>
        </div>

        <div className="flex justify-between">
          <Button onClick={addRow} variant="outline">
            <Plus className="mr-2 h-4 w-4" /> Add Row
          </Button>
          <Button disabled={!isValid || isSubmitting} onClick={handleSubmit}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {dryRunAll ? "Validate" : "Execute"} {rows.length} Turnover
            {rows.length > 1 ? "s" : ""}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
