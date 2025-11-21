"use client";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";

type RoleSwitcherProps = {
  roles: string[];
  selectedRole: string;
  setSelectedRole: (role: string) => void;
};

export function RoleSwitcher({
  roles,
  selectedRole,
  setSelectedRole,
}: RoleSwitcherProps) {
  if (!roles.includes("Admin")) {
    return null; // Only show to Admins
  }

  const availableRoles = ["Admin", "pr", "finance", "Control Committee", "hr"]; // Define all possible roles

  // During SSR and initial hydration, use a consistent value to avoid mismatch
  const selectValue = selectedRole;

  return (
    <div className="flex items-center justify-between p-4">
      <span className="text-gray-700">View site as:</span>
      <Select onValueChange={setSelectedRole} value={selectValue}>
        <SelectTrigger className="w-full rounded border p-2">
          <SelectValue placeholder="Select a role" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {availableRoles.map((role) => (
              <SelectItem key={role} value={role}>
                {role}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}
