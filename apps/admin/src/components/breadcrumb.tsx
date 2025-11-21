"use client";
import {
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Breadcrumb as DBreadcrumb,
} from "@repo/ui/components/ui/breadcrumb";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";

const Breadcrumb = () => {
  const pathname = usePathname();
  const pathArray = pathname.split("/").filter(Boolean);

  // Remove "admin" from pathArray, if it exists as the first segment
  if (pathArray[0] === "admin") {
    pathArray.shift();
  }

  return (
    <DBreadcrumb className="hidden md:flex">
      <BreadcrumbList>
        {/* Always show the "Home" link */}
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href="/admin">Home</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>

        {pathArray.length > 0 && <BreadcrumbSeparator />}

        {/* Dynamically create the rest of the breadcrumb links */}
        {pathArray.map((path, index) => {
          const href = "/admin/" + pathArray.slice(0, index + 1).join("/");

          // If it's the last item, show it as the current page
          if (index === pathArray.length - 1) {
            return (
              <BreadcrumbItem key={path}>
                <BreadcrumbPage>
                  {decodeURIComponent(path.charAt(0).toUpperCase() + path.slice(1))}
                </BreadcrumbPage>
              </BreadcrumbItem>
            );
          }

          // Otherwise, make it a clickable link with a separator
          return (
            <React.Fragment key={path}>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href={href}>
                    {decodeURIComponent(path.charAt(0).toUpperCase() + path.slice(1))}
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
            </React.Fragment>
          );
        })}
      </BreadcrumbList>
    </DBreadcrumb>
  );
};

export default Breadcrumb;
