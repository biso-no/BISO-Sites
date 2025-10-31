import { Client, Account, Databases, Query } from "@repo/api/server";
import { soapClient } from "./soapClient";

type Context = {
  req: any;
  res: any;
  log: (msg: any) => void;
  error: (msg: any) => void;
};

function normalizeHeaders(input: any): Record<string, string> {
  try {
    if (!input) return {};
    // WHATWG Headers
    if (typeof input.entries === "function") {
      const out: Record<string, string> = {};
      for (const [k, v] of input.entries()) {
        const val = Array.isArray(v) ? v.join(",") : String(v);
        out[String(k).toLowerCase()] = val;
      }
      return out;
    }
    // Node IncomingHttpHeaders-like
    const out: Record<string, string> = {};
    for (const k of Object.keys(input)) {
      const val = (input as any)[k];
      out[String(k).toLowerCase()] = Array.isArray(val) ? val.join(",") : String(val);
    }
    return out;
  } catch {
    return {};
  }
}

function maskHeaders(h: Record<string, string>): Record<string, string> {
  const SENSITIVE = new Set([
    "authorization",
    "x-appwrite-user-jwt",
    "x-appwrite-key",
    "cookie",
    "set-cookie",
  ]);
  const masked: Record<string, string> = {};
  for (const [k, v] of Object.entries(h)) {
    if (SENSITIVE.has(k)) {
      const str = String(v || "");
      masked[k] = str.length <= 8 ? "***" : `${str.slice(0, 3)}***${str.slice(-3)}`;
    } else {
      masked[k] = v;
    }
  }
  return masked;
}

export default async ({ req, res, log, error }: Context) => {
  try {
    log("[verify-membership] Invocation started");
    const endpoint = process.env.NEXT_PUBLIC_NEXT_PUBLIC_APPWRITE_ENDPOINT || process.env.APPWRITE_ENDPOINT || "https://appwrite.biso.no/v1";
    const project = process.env.NEXT_PUBLIC_APPWRITE_PROJECT || process.env.APPWRITE_PROJECT || "biso";
    const apiKey = process.env.APPWRITE_API_KEY;
    log(`[verify-membership] Config: endpoint=${endpoint}, project=${project}, apiKeyPresent=${Boolean(apiKey)}`);
    try {
      const hdr = normalizeHeaders(req?.headers);
      const masked = maskHeaders(hdr);
      log(`[verify-membership] Request headers: ${JSON.stringify(masked)}`);
    } catch {}
    const headers = req.headers;
    log(`User headers: ${headers}`)
    const userJwt =
      req.headers?.["x-appwrite-user-jwt"] ||
      req.headers?.["X-Appwrite-User-JWT"] ||
      req.variables?.APPWRITE_FUNCTION_USER_JWT ||
      req.variables?.APPWRITE_FUNCTION_JWT ||
      undefined;

    // Create client with user JWT to access their identities
    const userClient = new Client().setEndpoint(endpoint).setProject(project);
    if (userJwt) log(`[verify-membership] Received user JWT (length=${String(userJwt).length})`);
    if (userJwt) userClient.setJWT(userJwt as string);
    const account = new Account(userClient);

    const user = await account.get().catch((e) => {
      error(`[verify-membership] account.get() failed: ${e?.message || String(e)}`);
      return null;
    });
    if (!user?.$id) {
      log("[verify-membership] No authenticated user found via JWT");
      return res.json({ error: "Unauthenticated request" }, 401);
    }
    log(`[verify-membership] Authenticated user: id=${user.$id}, email=${(user as any)?.email || "n/a"}`);

    const list = await account.listIdentities().catch((e) => {
      error(`[verify-membership] listIdentities() failed: ${e?.message || String(e)}`);
      return null;
    });
    const identities = list?.identities || [];
    log(`[verify-membership] Identities found: count=${identities.length}`);
    try {
      const providers = identities.map((i: any) => ({ provider: i?.provider, uidSample: String(i?.providerUid || i?.userId || i?.$id || "").slice(0, 6) }));
      log(`[verify-membership] Identity providers: ${JSON.stringify(providers)}`);
    } catch {}

    const oidc = identities.find((i: any) => String(i.provider || "").toLowerCase() === "oidc");
    if (!oidc) {
      log("[verify-membership] No OIDC identity present");
      return res.json({ error: "No BI Student (OIDC) identity linked" }, 400);
    }

    const email: string | undefined = (oidc as any).providerEmail || (oidc as any).email || (oidc as any).userEmail || (oidc as any).providerUid;
    if (!email || typeof email !== "string") {
      log("[verify-membership] Could not resolve email from OIDC identity fields");
      return res.json({ error: "Could not resolve BI Student email from OIDC identity" }, 400);
    }
    const maskedEmail = (() => {
      const [local, domain] = email.split("@");
      if (!local || !domain) return "masked";
      const prefix = local.slice(0, 1);
      return `${prefix}***@${domain}`;
    })();
    log(`[verify-membership] OIDC email resolved (masked): ${maskedEmail}`);

    const local = email.split("@")[0] || "";
    const digits = local.replace(/[^0-9]/g, "");
    const studentId = parseInt(digits, 10);
    if (!digits || Number.isNaN(studentId)) {
      log(`[verify-membership] Local part parsing failed. local="${local}", digits="${digits}"`);
      return res.json({ error: "Invalid BI Student username format for membership lookup" }, 400);
    }
    log(`[verify-membership] Parsed studentId=${studentId} from local="${local}"`);

    // Admin client for DB
    const adminClient = new Client().setEndpoint(endpoint).setProject(project);
    if (apiKey) adminClient.setKey(apiKey);
    const databases = new Databases(adminClient);

    log("[verify-membership] Fetching active memberships from database...");
    const memberships = await databases.listDocuments("app", "memberships", [
      Query.equal("status", true),
      Query.select(["$id", "membership_id", "name", "price", "category", "status", "expiryDate"]),
    ]);

    if (!memberships.rows || memberships.rows.length === 0) {
      log("[verify-membership] No active memberships found in database");
      return res.json({ error: "No active memberships found" });
    }
    log(`[verify-membership] Active memberships: count=${memberships.rows.length}`);

    log("[verify-membership] Getting 24SevenOffice access token...");
    const { getAccessToken, userCategories } = soapClient(error, log);
    const accessToken = await getAccessToken();
    if (accessToken.status !== "ok") {
      error("[verify-membership] Failed to retrieve 24SevenOffice access token");
      return res.json({ error: "Failed to retrieve access token" });
    }

    log(`[verify-membership] Fetching categories from 24SevenOffice for student ${studentId}...`);
    const customerCategories = await userCategories(accessToken.accessToken, studentId);
    if (customerCategories.status !== "ok") {
      error(`[verify-membership] userCategories failed: ${JSON.stringify(customerCategories)}`);
      return res.json({ error: "Failed to retrieve customer categories" });
    }

    const categoryIds: number[] = customerCategories.data || [];
    log(`[verify-membership] 24SO categories for student ${studentId}: ${JSON.stringify(categoryIds)}`);
    const sortedMemberships = memberships.rows.sort(
      (a: any, b: any) => new Date(b.expiryDate).getTime() - new Date(a.expiryDate).getTime()
    );
    try {
      const cats = memberships.rows.map((m: any) => ({ id: m.$id, name: m.name, category: m.category, expiryDate: m.expiryDate }));
      log(`[verify-membership] DB memberships snapshot: ${JSON.stringify(cats)}`);
    } catch {}

    const latestMembership = sortedMemberships.find((m: any) =>
      categoryIds.some((cid) => String(cid) === String(m.category))
    );

    if (latestMembership) {
      log(`[verify-membership] Match found: membershipId=${latestMembership.$id}, name=${latestMembership.name}, category=${latestMembership.category}`);
      return res.json({ active: true, studentId, membership: latestMembership });
    }

    log(`[verify-membership] No match found. Returning inactive.`);
    return res.json({ active: false, studentId, categories: categoryIds });
  } catch (e: any) {
    error(`[verify-membership] Unexpected error: ${e?.stack || e?.message || String(e)}`);
    return res.json({ error: "Unexpected error" }, 500);
  }
};
