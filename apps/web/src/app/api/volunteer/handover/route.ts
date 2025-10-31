import type { NextApiRequest, NextApiResponse } from "next";
import { spawn } from "child_process";
import { createSessionClient } from "@repo/api/server";
import { getUserRoles} from "@/lib/admin/account";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { account } = await createSessionClient();
  const user = await account.get();
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const roles = await getUserRoles();
  if (!roles.includes("admin")) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { roleMailbox, oldDelegate, newDelegate } = req.body;

  if (!roleMailbox || !oldDelegate || !newDelegate) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const ps = spawn("pwsh", [
      "-File",
      "./scripts/handover.ps1",
      "-RoleMailbox", roleMailbox,
      "-OldDelegate", oldDelegate,
      "-NewDelegate", newDelegate,
    ], {
      env: {
        ...process.env, // pass .env.local values
      },
    });

    let output = "";
    let errorOutput = "";

    ps.stdout.on("data", (data) => {
      output += data.toString();
    });

    ps.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });

    ps.on("close", (code) => {
      try {
        const parsed = JSON.parse(output.trim());
        if (code === 0) {
          res.status(200).json(parsed);
        } else {
          res.status(500).json(parsed);
        }
      } catch {
        res.status(code === 0 ? 200 : 500).json({
          success: code === 0,
          raw: output.trim(),
          error: errorOutput.trim(),
        });
      }
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
}
