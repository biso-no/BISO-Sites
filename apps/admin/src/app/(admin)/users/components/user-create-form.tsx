"use client";

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@repo/ui/components/ui/alert";
import { Button } from "@repo/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { apiClient } from "@/lib/api-client";

type Campus = { id: string; name: string; officeLocation: string };
type Department = { id: string; name: string; code: string; campusId: string };
type Group = { id: string; displayName: string; description?: string };

type CreateUserResult = {
  success: boolean;
  user?: { id: string; displayName: string; upn: string };
  temporaryPassword?: string;
  groupsAssigned?: string[];
  error?: string;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button className="w-full" disabled={pending} type="submit">
      {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {pending ? "Creating User..." : "Create User"}
    </Button>
  );
}

export function UserCreateForm() {
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [adminGroups, setAdminGroups] = useState<Group[]>([]);
  const [selectedCampusId, setSelectedCampusId] = useState<string>("");
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>("");
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [result, setResult] = useState<CreateUserResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingDepts, setLoadingDepts] = useState(false);

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

  // Fetch admin groups on mount
  useEffect(() => {
    async function fetchGroups() {
      try {
        const data = await apiClient.fetch<{ groups: Group[] }>(
          "/api/admin/admin-groups"
        );
        setAdminGroups(data.groups || []);
      } catch (error) {
        console.error("Failed to fetch admin groups:", error);
      }
    }
    fetchGroups();
  }, []);

  // Fetch departments when campus changes
  useEffect(() => {
    if (!selectedCampusId) {
      setDepartments([]);
      setSelectedDepartmentId("");
      return;
    }

    async function fetchDepartments() {
      setLoadingDepts(true);
      try {
        const data = await apiClient.fetch<{ departments: Department[] }>(
          `/api/admin/departments?campusId=${selectedCampusId}`
        );
        setDepartments(data.departments || []);
        setSelectedDepartmentId(""); // Reset selection
      } catch (error) {
        console.error("Failed to fetch departments:", error);
      } finally {
        setLoadingDepts(false);
      }
    }
    fetchDepartments();
  }, [selectedCampusId]);

  async function handleSubmit(formData: FormData) {
    setIsLoading(true);
    setResult(null);

    const payload = {
      firstName: formData.get("firstName") as string,
      lastName: formData.get("lastName") as string,
      campusId: selectedCampusId,
      departmentId: selectedDepartmentId,
      managerId: (formData.get("managerId") as string) || undefined,
      additionalGroupIds: selectedGroupIds,
    };

    try {
      const data = await apiClient.fetch<CreateUserResult>("/api/admin/users", {
        method: "POST",
        body: payload,
      });

      setResult({
        success: true,
        user: data.user,
        temporaryPassword: data.temporaryPassword,
        groupsAssigned: data.groupsAssigned,
      });
    } catch (error: any) {
      setResult({ success: false, error: error.message || "Network error" });
    } finally {
      setIsLoading(false);
    }
  }

  function toggleGroup(groupId: string) {
    setSelectedGroupIds((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId]
    );
  }

  return (
    <Card className="mx-auto w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Create New User</CardTitle>
        <CardDescription>
          Provision a new user in M365 with campus and department assignment.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {result && (
          <Alert
            className="mb-6"
            variant={result.success ? "default" : "destructive"}
          >
            {result.success ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertTitle>{result.success ? "Success" : "Error"}</AlertTitle>
            <AlertDescription>
              {result.success ? (
                <div className="space-y-2">
                  <p>
                    User created: <strong>{result.user?.upn}</strong>
                  </p>
                  <p className="rounded bg-muted p-2 font-mono text-sm">
                    Temporary Password: {result.temporaryPassword}
                  </p>
                  {result.groupsAssigned && (
                    <p>Groups assigned: {result.groupsAssigned.join(", ")}</p>
                  )}
                </div>
              ) : (
                result.error
              )}
            </AlertDescription>
          </Alert>
        )}

        <form action={handleSubmit} className="space-y-6">
          {/* Name Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                maxLength={64}
                name="firstName"
                placeholder="John"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                maxLength={64}
                name="lastName"
                placeholder="Doe"
                required
              />
            </div>
          </div>

          {/* Campus Select */}
          <div className="space-y-2">
            <Label htmlFor="campus">Campus</Label>
            <Select
              onValueChange={setSelectedCampusId}
              value={selectedCampusId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select campus..." />
              </SelectTrigger>
              <SelectContent>
                {campuses.map((campus) => (
                  <SelectItem key={campus.id} value={campus.id}>
                    {campus.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Department Select (dependent) */}
          <div className="space-y-2">
            <Label htmlFor="department">Department</Label>
            <Select
              disabled={!selectedCampusId || loadingDepts}
              onValueChange={setSelectedDepartmentId}
              value={selectedDepartmentId}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    loadingDepts
                      ? "Loading..."
                      : selectedCampusId
                        ? "Select department..."
                        : "Select campus first"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name} ({dept.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Manager ID (optional) */}
          <div className="space-y-2">
            <Label htmlFor="managerId">Manager ID (optional)</Label>
            <Input
              id="managerId"
              name="managerId"
              placeholder="Azure AD Object ID of manager"
            />
            <p className="text-muted-foreground text-xs">
              Enter the Azure AD Object ID of the user's manager.
            </p>
          </div>

          {/* Additional Groups */}
          {adminGroups.length > 0 && (
            <div className="space-y-2">
              <Label>Additional Groups (optional)</Label>
              <div className="grid max-h-40 grid-cols-2 gap-2 overflow-y-auto rounded border p-2">
                {adminGroups.map((group) => (
                  <label
                    className="flex cursor-pointer items-center gap-2 rounded p-1 text-sm hover:bg-muted"
                    key={group.id}
                  >
                    <input
                      checked={selectedGroupIds.includes(group.id)}
                      className="rounded"
                      onChange={() => toggleGroup(group.id)}
                      type="checkbox"
                    />
                    <span className="truncate">{group.displayName}</span>
                  </label>
                ))}
              </div>
              <p className="text-muted-foreground text-xs">
                Select additional groups beyond the required security groups.
              </p>
            </div>
          )}

          <SubmitButton />
        </form>
      </CardContent>
    </Card>
  );
}
