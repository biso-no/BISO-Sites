import { RolePaths } from "components/landing/role-paths";
import { SplitHero } from "components/landing/split-hero";
import { TaskGroups } from "components/landing/task-groups";
import { readingPaths, taskGroups } from "lib/landing";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "BISO Docs" };

export default function Home() {
  return (
    <main className="flex-1">
      <SplitHero />
      <RolePaths paths={readingPaths} />
      <TaskGroups groups={taskGroups} />
    </main>
  );
}
