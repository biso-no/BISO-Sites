import { tool } from "ai";
import { z } from "zod";
import type { RouteInfo } from "../types";

const navigationSchema = z.object({
  path: z
    .string()
    .describe("The path to navigate to, e.g., /admin/events/new"),
  reason: z
    .string()
    .optional()
    .describe("Brief explanation of why navigating to this page"),
});

type NavigationParams = z.infer<typeof navigationSchema>;

/**
 * Create a navigation tool for the assistant
 * This tool allows the AI to redirect users to specific pages
 */
export function createNavigationTool(availableRoutes: RouteInfo[]) {
  const routePaths = availableRoutes.map((r) => r.path);

  return tool({
    description: `Navigate the user to a specific page in the admin dashboard. Available routes: ${routePaths.join(", ")}`,
    inputSchema: navigationSchema,
    execute: async ({ path, reason }: NavigationParams) => {
      // Validate the path is in available routes or is a valid subpath
      const isValidPath = availableRoutes.some(
        (route) => path === route.path || path.startsWith(`${route.path}/`)
      );

      if (!isValidPath) {
        return await Promise.resolve({
          success: false,
          error: `Invalid path: ${path}. Available routes: ${routePaths.join(", ")}`,
        });
      }

      // Return action for the client to execute
      return await Promise.resolve({
        success: true,
        action: {
          type: "navigation" as const,
          path,
          description: reason,
        },
        message: reason
          ? `Navigating to ${path}: ${reason}`
          : `Navigating to ${path}`,
      });
    },
  });
}

/**
 * Default admin routes for BISO admin dashboard
 */
export const defaultAdminRoutes: RouteInfo[] = [
  {
    path: "/admin",
    label: "Dashboard",
    description: "Main admin dashboard with overview",
    requiredRoles: ["Admin"],
  },
  {
    path: "/admin/events",
    label: "Events",
    description: "View and manage all events",
    requiredRoles: ["Admin", "pr"],
  },
  {
    path: "/admin/events/new",
    label: "Create Event",
    description: "Create a new event",
    requiredRoles: ["Admin", "pr"],
  },
  {
    path: "/admin/posts",
    label: "Posts",
    description: "View and manage blog posts",
    requiredRoles: ["Admin", "pr"],
  },
  {
    path: "/admin/jobs",
    label: "Jobs",
    description: "View and manage job listings",
    requiredRoles: ["Admin", "hr", "pr"],
  },
  {
    path: "/admin/jobs/applications",
    label: "Applications",
    description: "View job applications",
    requiredRoles: ["Admin", "hr", "pr"],
  },
  {
    path: "/admin/shop",
    label: "Shop",
    description: "Manage shop and products",
    requiredRoles: ["Admin", "finance"],
  },
  {
    path: "/admin/shop/products",
    label: "Products",
    description: "Manage shop products",
    requiredRoles: ["Admin", "finance"],
  },
  {
    path: "/admin/shop/orders",
    label: "Orders",
    description: "View and manage orders",
    requiredRoles: ["Admin", "finance"],
  },
  {
    path: "/admin/units",
    label: "Units",
    description: "Manage organizational units",
    requiredRoles: ["Admin", "hr", "finance", "pr"],
  },
  {
    path: "/admin/users",
    label: "Users",
    description: "Manage users and permissions",
    requiredRoles: ["Admin", "hr", "finance"],
  },
  {
    path: "/admin/pages",
    label: "Pages",
    description: "Manage website pages",
    requiredRoles: ["Admin", "pr"],
  },
  {
    path: "/admin/settings",
    label: "Settings",
    description: "Admin settings",
    requiredRoles: ["Admin"],
  },
];
