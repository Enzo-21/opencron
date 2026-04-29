import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url") || "";
  const statePath = process.env.OPENCRON_STATE_PATH || "";
  if (!url) return NextResponse.json({ logs: [] });
  // Prefer persisted state file if provided
  if (statePath) {
    try {
      const raw = await fs.readFile(statePath, "utf8");
      const json = JSON.parse(raw);
      const logs = Array.isArray(json?.logsByUrl?.[url]) ? json.logsByUrl[url] : [];
      return NextResponse.json({ logs });
    } catch {
      // fall through to file-based logs
    }
  }

  // Fallback: read per-host JSON file from logs/ directory
  try {
    const logsDir = process.env.LOGS_DIR || path.join(process.cwd(), "logs");
    const host = (() => {
      try {
        return new URL(url).hostname;
      } catch (_) {
        return String(url).replace(/[^a-z0-9.-]/gi, "-").toLowerCase();
      }
    })();
    const file = path.join(logsDir, `${host}.json`);
    const raw = await fs.readFile(file, "utf8");
    const json = JSON.parse(raw);
    const logs = Array.isArray(json?.entries) ? json.entries : [];
    return NextResponse.json({ logs });
  } catch {
    return NextResponse.json({ logs: [] });
  }
}
