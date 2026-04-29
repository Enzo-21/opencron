import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const statePath = process.env.OPENCRON_STATE_PATH || "";
  const now = Date.now();
  if (!statePath) {
    return NextResponse.json({ now, last: {} });
  }
  try {
    const raw = await fs.readFile(statePath, "utf8");
    const json = JSON.parse(raw);
    const last: Record<string, number> = {};
    const lastSec = json?.lastSecondByUrl || {};
    const lastMin = json?.lastMinuteByUrl || {};
    for (const [url, sec] of Object.entries(lastSec)) {
      const n = Number(sec);
      if (Number.isFinite(n)) last[url] = n * 1000;
    }
    for (const [url, min] of Object.entries(lastMin)) {
      const n = Number(min);
      if (Number.isFinite(n)) last[url] = Math.max(last[url] || 0, n * 60_000);
    }
    return NextResponse.json({ now, last });
  } catch {
    return NextResponse.json({ now, last: {} });
  }
}
