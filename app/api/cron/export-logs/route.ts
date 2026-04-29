import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const logsDir = process.env.LOGS_DIR || path.join(process.cwd(), "logs");
  try {
    const stat = await fs.stat(logsDir).catch(() => null);
    if (!stat) return NextResponse.json([]);
    const files = await fs.readdir(logsDir);
    const all = [];
    for (const f of files) {
      if (!f.endsWith(".json")) continue;
      try {
        const raw = await fs.readFile(path.join(logsDir, f), "utf8");
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
