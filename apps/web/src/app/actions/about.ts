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
  try {
    const { db } = await createSessionClient();
    const partners = await db.listRows<Partner>("app", "partners", [
      Query.equal("level", "national"),
    ]);

    return partners.rows;
  } catch (error) {
    console.error("Failed to fetch partners:", error);
    return [];
  }
}

export async function getOrgChartUrl() {
  const { storage } = await createSessionClient();
  const arrayBuffer = await storage.getFilePreview("content", "org_chart");
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  const dataUrl = `data:image/png;base64,${base64}`;
  return dataUrl;
}
