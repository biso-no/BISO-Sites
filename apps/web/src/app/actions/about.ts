"use server";
import { Buffer } from "node:buffer";
import { type Models, Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";

export type Partner = Models.Row & {
  name: string;
  url?: string;
  level: string;
  campusId: string;
  image_url: string;
};

export async function getPartners() {
  const { db } = await createSessionClient();
  const partners = await db.listRows<Partner>("app", "partners", [
    Query.equal("level", "national"),
  ]);

  console.log("Partners:", partners);
  return partners.rows;
}

export async function getOrgChartUrl() {
  const { storage } = await createSessionClient();
  const arrayBuffer = await storage.getFilePreview("content", "org_chart");
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  const dataUrl = `data:image/png;base64,${base64}`;
  console.log("Org chart url:", dataUrl.substring(0, 64) + "...");
  return dataUrl;
}
