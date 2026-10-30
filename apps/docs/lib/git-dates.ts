export type GitRunner = (
  args: string[]
) => Promise<{ exitCode: number; stdout: string }>;

/**
 * Builds a last-commit-date lookup. In a shallow clone (or without git) every
 * file would report the same deploy commit, so it returns null for all files
 * rather than show a false "Updated" date.
 */
export function createGitDateLookup(run: GitRunner) {
  let usable: Promise<boolean> | undefined;

  const checkUsable = async (): Promise<boolean> => {
    try {
      const { exitCode, stdout } = await run([
        "rev-parse",
        "--is-shallow-repository",
      ]);
      return exitCode === 0 && stdout.trim() === "false";
    } catch {
      return false;
    }
  };

  return async (file: string): Promise<Date | null> => {
    usable ??= checkUsable();
    if (!(await usable)) {
      return null;
    }
    try {
      const { exitCode, stdout } = await run([
        "log",
        "-1",
        "--format=%aI",
        "--",
        file,
      ]);
      if (exitCode !== 0) {
        return null;
      }
      const date = new Date(stdout.trim());
      return Number.isNaN(date.getTime()) ? null : date;
    } catch {
      return null;
    }
  };
}
