"use server";

import fs from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import type { OpenCronConfig } from "@/lib/opencron";
import { isValidCronExpression } from "@/lib/opencron";

/** Returns true if `value` is an absolute http(s) URL. */
function isAbsoluteUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Server action: create a new cron entry in opencron.json.
 * Validates absolute URL and 5-field cron expression and prevents duplicates by URL.
 */
export async function addCron(formData: FormData) {
  const rawUrl = (formData.get("url") ?? "").toString().trim();
  const rawSchedule = (formData.get("schedule") ?? "").toString().trim();

  if (!isAbsoluteUrl(rawUrl)) {
    throw new Error("URL must be absolute and start with http(s)://");
  }
  if (!rawSchedule) {
    throw new Error("Schedule is required");
  }
  if (!isValidCronExpression(rawSchedule)) {
    throw new Error("Schedule must be a valid 5-field cron expression");
  }

  const filePath = path.join(process.cwd(), "opencron.json");

  let config: OpenCronConfig = { crons: [] };
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const json = JSON.parse(raw);
    if (Array.isArray(json?.crons)) {
      config.crons = json.crons as any;
    }
  } catch (err: any) {
    if (err?.code !== "ENOENT") {
      throw err;
    }
  }

  // Basic duplicate detection by URL
  if (config.crons.some((c) => c.url === rawUrl)) {
    throw new Error("A cron with this URL already exists");
  }

  config.crons.push({ url: rawUrl, schedule: rawSchedule });

  const body = JSON.stringify({ crons: config.crons }, null, 2) + "\n";
  await fs.writeFile(filePath, body, "utf8");

  revalidatePath("/");
}

/** Server action: delete one cron by index. No-op if file missing. */
export async function deleteCron(formData: FormData) {
  const rawIndex = (formData.get("index") ?? "").toString();
  const index = Number(rawIndex);
  if (!Number.isInteger(index)) throw new Error("Invalid index");

  const filePath = path.join(process.cwd(), "opencron.json");
  let config: OpenCronConfig = { crons: [] };
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const json = JSON.parse(raw);
    if (Array.isArray(json?.crons)) config.crons = json.crons as any;
  } catch (err: any) {
    if (err?.code === "ENOENT") return; // nothing to delete
    throw err;
  }

  if (index < 0 || index >= config.crons.length) {
    throw new Error("Index out of range");
  }
  config.crons.splice(index, 1);

  const body = JSON.stringify({ crons: config.crons }, null, 2) + "\n";
  await fs.writeFile(filePath, body, "utf8");
  revalidatePath("/");
}

/**
 * Server action: update one cron by index.
 * Enforces absolute URL, valid cron, and duplicate protection (by URL).
 */
export async function updateCron(formData: FormData) {
  const rawIndex = (formData.get("index") ?? "").toString();
  const index = Number(rawIndex);
  const rawUrl = (formData.get("url") ?? "").toString().trim();
  const rawSchedule = (formData.get("schedule") ?? "").toString().trim();

  if (!Number.isInteger(index)) throw new Error("Invalid index");
  if (!isAbsoluteUrl(rawUrl)) throw new Error("URL must be absolute http(s)");
  if (!rawSchedule) throw new Error("Schedule is required");
  if (!isValidCronExpression(rawSchedule)) {
    throw new Error("Schedule must be a valid 5-field cron expression");
  }

  const filePath = path.join(process.cwd(), "opencron.json");
  let config: OpenCronConfig = { crons: [] };
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const json = JSON.parse(raw);
    if (Array.isArray(json?.crons)) config.crons = json.crons as any;
  } catch (err: any) {
    if (err?.code === "ENOENT") throw new Error("opencron.json not found");
    throw err;
  }

  if (index < 0 || index >= config.crons.length) {
    throw new Error("Index out of range");
  }

  // Duplicate by URL excluding the same index
  if (config.crons.some((c, i) => i !== index && c.url === rawUrl)) {
    throw new Error("Another cron with this URL already exists");
  }

  config.crons[index] = { url: rawUrl, schedule: rawSchedule };

  const body = JSON.stringify({ crons: config.crons }, null, 2) + "\n";
  await fs.writeFile(filePath, body, "utf8");
  revalidatePath("/");
}

/**
 * Server action: reorder crons in bulk.
 * Expects a CSV string in `order` containing the CURRENT indices in the desired new order.
 * Example: if there are 4 items and you want [2,0,1,3], send order="2,0,1,3".
 */
export async function reorderCronBulk(formData: FormData) {
  const raw = (formData.get("order") ?? "").toString().trim();
  if (!raw) return;
  const indices = raw
    .split(",")
    .map((s) => Number(s))
    .filter((n) => Number.isInteger(n));

  const filePath = path.join(process.cwd(), "opencron.json");
  let config: OpenCronConfig = { crons: [] };
  try {
    const content = await fs.readFile(filePath, "utf8");
    const json = JSON.parse(content);
    if (Array.isArray(json?.crons)) config.crons = json.crons as any;
  } catch (err: any) {
    if (err?.code === "ENOENT") return;
    throw err;
  }

  const n = config.crons.length;
  const seen = new Set<number>();
  const clean = indices.filter((i) => i >= 0 && i < n && !seen.has(i) && seen.add(i));
  if (clean.length !== n) {
    // If something went wrong, do not partially reorder.
    return;
  }
  const reordered = clean.map((i) => config.crons[i]);
  await fs.writeFile(filePath, JSON.stringify({ crons: reordered }, null, 2) + "\n", "utf8");
  revalidatePath("/");
}

export async function reorderCron(formData: FormData) {
  const rawFrom = (formData.get("from") ?? "").toString();
  const rawTo = (formData.get("to") ?? "").toString();
  const from = Number(rawFrom);
  const to = Number(rawTo);
  if (!Number.isInteger(from) || !Number.isInteger(to)) throw new Error("Invalid indices");

  const filePath = path.join(process.cwd(), "opencron.json");
  let config: OpenCronConfig = { crons: [] };
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const json = JSON.parse(raw);
    if (Array.isArray(json?.crons)) config.crons = json.crons as any;
  } catch (err: any) {
    if (err?.code === "ENOENT") return; // nothing to reorder
    throw err;
  }

  if (
    from < 0 ||
    from >= config.crons.length ||
    to < 0 ||
    to >= config.crons.length ||
    from === to
  ) {
    return;
  }

  const [moved] = config.crons.splice(from, 1);
  config.crons.splice(to, 0, moved);

  const body = JSON.stringify({ crons: config.crons }, null, 2) + "\n";
  await fs.writeFile(filePath, body, "utf8");
  revalidatePath("/");
}
