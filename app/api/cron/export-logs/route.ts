import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  // Dynamically import fs/path to avoid top-level filesystem imports being traced by Turbopack
  const fs = await import("node:fs/promises");
  const path = await import("node:path");

  const logsDir = process.env.LOGS_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), "logs");
  try {
    const stat = await fs.stat(logsDir).catch(() => null);
    if (!stat) return NextResponse.json([]);
    const files = await fs.readdir(logsDir);
    const all: any[] = [];
    for (const f of files) {
      if (!f.endsWith(".json")) continue;
      try {
        const raw = await fs.readFile(/*turbopackIgnore: true*/ path.join(logsDir, f), "utf8");
        const obj = JSON.parse(raw);
        const host = obj?.meta?.host || f.replace(/\.json$/i, "");
        const url = obj?.meta?.url || null;
        const entries = Array.isArray(obj?.entries) ? obj.entries : [];
        for (const e of entries) {
          all.push(Object.assign({ host, url }, e));
        }
      } catch (_) {
        // ignore corrupt files
      }
    }
    return NextResponse.json(all);
  } catch (err) {
    return NextResponse.json({ error: String((err as any)?.message ?? err) }, { status: 500 });
  }
}
