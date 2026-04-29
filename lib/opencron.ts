import fs from "node:fs/promises";
import path from "node:path";
import { isValidCronExpression, cronMatchesDate } from "@/lib/cron-core";

/**
 * Types and helpers for reading and validating the OpenCron configuration.
 * The config is a single JSON file at the project root (opencron.json)
 * with an array of entries containing absolute URLs and 5-field cron schedules.
 */

export type OpenCronEntry = {
  url: string; // required absolute URL
  schedule: string; // cron expression
};

export type OpenCronConfig = {
  crons: OpenCronEntry[];
};

type ReadResult = {
  config: OpenCronConfig | null;
  errors: string[];
};

/** Returns true if `value` is an absolute http(s) URL. */
function isAbsoluteUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Numeric guard for inclusive integer range checks. */
function numberInRange(n: number, min: number, max: number) {
  return Number.isInteger(n) && n >= min && n <= max;
}

/**
 * Validates one cron field (minute/hour/day/month/dow)
 * - Supports wildcard '*', step syntax ('star-slash-n'), single values, ranges (a-b), and comma-separated lists.
 */
function validateCronField(part: string, min: number, max: number): boolean {
  // Accept: "*", "*/n", "a", "a-b", lists "x,y,z", and combinations like "1-5,10,*/15"
  const segments = part.split(",");
  for (const seg of segments) {
    if (seg === "*") continue;
    if (seg.startsWith("*/")) {
      const step = Number(seg.slice(2));
      if (!numberInRange(step, 1, max - min + 1)) return false;
      continue;
    }
    const range = seg.split("-");
    if (range.length === 2) {
      const a = Number(range[0]);
      const b = Number(range[1]);
      if (!numberInRange(a, min, max) || !numberInRange(b, min, max) || a > b) return false;
      continue;
    }
    const single = Number(seg);
    if (!numberInRange(single, min, max)) return false;
  }
  return true;
}

export { isValidCronExpression };

/** Returns true if a cron field `part` includes a specific numeric `value`. */
function fieldIncludes(part: string, value: number, min: number, max: number): boolean {
  // Accept same syntax as validateCronField
  const segments = part.split(",");
  for (const seg of segments) {
    if (seg === "*") return true;
    if (seg.startsWith("*/")) {
      const step = Number(seg.slice(2));
      if (!numberInRange(step, 1, max - min + 1)) continue;
      if ((value - min) % step === 0) return true;
      continue;
    }
    const range = seg.split("-");
    if (range.length === 2) {
      const a = Number(range[0]);
      const b = Number(range[1]);
      if (!numberInRange(a, min, max) || !numberInRange(b, min, max) || a > b) continue;
      if (value >= a && value <= b) return true;
      continue;
    }
    const single = Number(seg);
    if (numberInRange(single, min, max) && value === single) return true;
  }
  return false;
}

/**
 * Evaluates whether a 5-field cron expression matches a given Date (UTC semantics).
 * Implements OR behavior between DOM and DOW fields, commonly used by popular crons.
 */
export { cronMatchesDate };

/**
 * Normalizes one raw JSON entry into a typed entry, collecting validation errors.
 * Accepts legacy `path` for convenience but expects absolute `url` in practice.
 */
function normalizeEntry(raw: any, index: number, errors: string[]): OpenCronEntry | null {
  // Support either `url` (preferred) or a fully-qualified `path` for convenience
  const url: unknown = raw?.url ?? raw?.path;
  const schedule: unknown = raw?.schedule;

  if (typeof url !== "string" || !isAbsoluteUrl(url)) {
    errors.push(`crons[${index}].url must be an absolute http(s) URL`);
    return null;
  }
  if (typeof schedule !== "string" || !schedule.trim()) {
    errors.push(`crons[${index}].schedule must be a non-empty string`);
    return null;
  }
  if (!isValidCronExpression(schedule)) {
    errors.push(`crons[${index}].schedule is not a valid 5-field cron expression`);
  }
  return { url, schedule };
}

/** Reads and validates opencron.json from the project root. */
export async function readOpenCronConfig(): Promise<ReadResult> {
  const errors: string[] = [];
  const filePath = path.join(process.cwd(), "opencron.json");

  try {
    const raw = await fs.readFile(filePath, "utf8");
    const json = JSON.parse(raw);
    const cronsRaw: unknown[] = Array.isArray(json?.crons) ? (json.crons as unknown[]) : [];
    if (!Array.isArray(json?.crons)) {
      errors.push("Missing required 'crons' array in opencron.json");
    }
    const crons: OpenCronEntry[] = [];
    const seen = new Set<string>();
    cronsRaw.forEach((item: unknown, i: number) => {
      const entry = normalizeEntry(item, i, errors);
      if (entry) {
        if (seen.has(entry.url)) {
          errors.push(`Duplicate URL detected at crons[${i}]: ${entry.url}`);
        }
        seen.add(entry.url);
        crons.push(entry);
      }
    });
    if (errors.length > 0) {
      return { config: { crons }, errors };
    }
    return { config: { crons }, errors: [] };
  } catch (err: any) {
    if (err && (err.code === "ENOENT" || err.code === "MODULE_NOT_FOUND")) {
      return { config: null, errors: ["opencron.json not found at project root"] };
    }
    return { config: null, errors: ["Failed to read opencron.json", String(err?.message ?? err)] };
  }
}
