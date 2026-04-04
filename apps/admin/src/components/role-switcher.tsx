"use client";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { DEPARTMENT_ROLE, ROLES } from "@/lib/roles";

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
  if (!roles.includes(ROLES.GLOBAL_ADMIN)) {
    return null; // Only show to Global Admins
  }

  const availableRoles = [
    ROLES.GLOBAL_ADMIN,
    ROLES.CAMPUS_ADMIN,
    DEPARTMENT_ROLE,
  ];

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
