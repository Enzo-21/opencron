import { NextResponse } from "next/server";

// Keep runtime dynamic and nodejs for server-side file access
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const statePath = process.env.OPENCRON_STATE_PATH || "";
  const now = Date.now();
  if (!statePath) {
    return NextResponse.json({ now, last: {} });
  }
  try {
    // Dynamically import fs to avoid top-level filesystem imports being traced by Turbopack/NFT
    const fs = await import("node:fs/promises");
    // Tell Turbopack to ignore this dynamic file path when tracing
    const raw = await fs.readFile(/*turbopackIgnore: true*/ statePath, "utf8");
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
