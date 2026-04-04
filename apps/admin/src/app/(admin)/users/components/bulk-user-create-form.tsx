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
import { Input } from "@repo/ui/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/ui/table";
import { AlertCircle, CheckCircle2, Loader2, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";

interface Campus {
  id: string;
  name: string;
}
interface Department {
  campusId: string;
  code: string;
  id: string;
  name: string;
}

interface UserRow {
  campusId: string;
  departmentId: string;
  firstName: string;
  id: string;
  lastName: string;
}

interface RowResult {
  error?: string;
  index: number;
  input: { firstName: string; lastName: string };
  success: boolean;
  temporaryPassword?: string;
  user?: { id: string; displayName: string; upn: string };
}

interface BulkResult {
  results: RowResult[];
  totalFailed: number;
  totalRequested: number;
  totalSucceeded: number;
}

export function BulkUserCreateForm() {
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [departmentsByCompus, setDepartmentsByCampus] = useState<
    Record<string, Department[]>
  >({});
  const [rows, setRows] = useState<UserRow[]>([createEmptyRow()]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<BulkResult | null>(null);

  function createEmptyRow(): UserRow {
    return {
      id: crypto.randomUUID(),
      firstName: "",
      lastName: "",
      campusId: "",
      departmentId: "",
    };
  }

  // Fetch campuses on mount
  useEffect(() => {
    async function fetchCampuses() {
      try {
        const data = await apiClient.fetch<{ campuses: Campus[] }>(
          "/api/admin/campuses"
        );
        setCampuses(data.campuses || []);
      } catch (error) {
        console.error("Failed to fetch campuses:", error);
      }
    }
    fetchCampuses();
  }, []);

  // Fetch departments when campuses are selected
  async function fetchDepartmentsForCampus(campusId: string) {
    if (departmentsByCompus[campusId]) {
      return;
    }

    try {
      const data = await apiClient.fetch<{ departments: Department[] }>(
        `/api/admin/departments?campusId=${campusId}`
      );
      setDepartmentsByCampus((prev) => ({
        ...prev,
        [campusId]: data.departments || [],
      }));
    } catch (error) {
      console.error("Failed to fetch departments:", error);
    }
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

  function updateRow(id: string, field: keyof UserRow, value: string) {
    setRows(
      rows.map((r) => {
        if (r.id !== id) {
          return r;
        }
        const updated = { ...r, [field]: value };
        // Clear department if campus changed
        if (field === "campusId") {
          updated.departmentId = "";
          fetchDepartmentsForCampus(value);
        }
        return updated;
      })
    );
  }

  async function handleSubmit() {
    setIsSubmitting(true);
    setResult(null);

    const payload = {
      users: rows.map((r) => ({
        firstName: r.firstName,
        lastName: r.lastName,
        campusId: r.campusId,
        departmentId: r.departmentId,
        additionalGroupIds: [],
      })),
    };

    try {
      const data = await apiClient.fetch<BulkResult>("/api/admin/users/bulk", {
        method: "POST",
        body: payload,
      });

      setResult(data);
    } catch (error) {
      console.error("Bulk creation failed:", error);
    } finally {
      setIsSubmitting(false);
    }
  }

  const isValid = rows.every(
    (r) => r.firstName && r.lastName && r.campusId && r.departmentId
  );

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Bulk Create Users</CardTitle>
        <CardDescription>
          Create multiple users at once. Each user will be assigned to their
          specified campus and department.
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
              {result.totalSucceeded} of {result.totalRequested} users created
            </AlertTitle>
            <AlertDescription>
              {result.totalFailed > 0 && (
                <div className="mt-2">
                  <p className="font-medium">Failed rows:</p>
                  <ul className="list-disc pl-4 text-sm">
                    {result.results
                      .filter((r) => !r.success)
                      .map((r) => (
                        <li key={r.index}>
                          Row {r.index + 1}: {r.error}
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Results Table (shown after successful submission) */}
        {result && result.totalSucceeded > 0 && (
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>UPN</TableHead>
                  <TableHead>Temp Password</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.results.map((r) => (
                  <TableRow key={r.index}>
                    <TableCell>
                      {r.input.firstName} {r.input.lastName}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {r.user?.upn || "-"}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {r.temporaryPassword || "-"}
                    </TableCell>
                    <TableCell>
                      {r.success ? (
                        <Badge className="text-green-600" variant="outline">
                          Success
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
                <TableHead>First Name</TableHead>
                <TableHead>Last Name</TableHead>
                <TableHead>Campus</TableHead>
                <TableHead>Department</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Input
                      onChange={(e) =>
                        updateRow(row.id, "firstName", e.target.value)
                      }
                      placeholder="John"
                      value={row.firstName}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      onChange={(e) =>
                        updateRow(row.id, "lastName", e.target.value)
                      }
                      placeholder="Doe"
                      value={row.lastName}
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      onValueChange={(v) => updateRow(row.id, "campusId", v)}
                      value={row.campusId}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="Campus..." />
                      </SelectTrigger>
                      <SelectContent>
                        {campuses.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select
                      disabled={!row.campusId}
                      onValueChange={(v) =>
                        updateRow(row.id, "departmentId", v)
                      }
                      value={row.departmentId}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Department..." />
                      </SelectTrigger>
                      <SelectContent>
                        {(departmentsByCompus[row.campusId] || []).map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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

        <div className="flex justify-between">
          <Button onClick={addRow} variant="outline">
            <Plus className="mr-2 h-4 w-4" /> Add Row
          </Button>
          <Button disabled={!isValid || isSubmitting} onClick={handleSubmit}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create {rows.length} User{rows.length > 1 ? "s" : ""}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
