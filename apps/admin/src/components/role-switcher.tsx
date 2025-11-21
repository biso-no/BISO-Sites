"use client";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";

interface RoleSwitcherProps {
  roles: string[];
  selectedRole: string;
  setSelectedRole: (role: string) => void;
}

export function RoleSwitcher({
  roles,
  selectedRole,
  setSelectedRole,
}: RoleSwitcherProps) {
  if (!roles.includes("Admin")) return null; // Only show to Admins

  const availableRoles = ["Admin", "pr", "finance", "Control Committee", "hr"]; // Define all possible roles

  // During SSR and initial hydration, use a consistent value to avoid mismatch
  const selectValue = selectedRole;

  return (
    <div className="p-4 flex justify-between items-center">
      <span className="text-gray-700">View site as:</span>
      <Select value={selectValue} onValueChange={setSelectedRole}>
        <SelectTrigger className="w-full p-2 border rounded">
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
