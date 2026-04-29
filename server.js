/*
 Minimal custom server to run Next.js and a minute‑aligned in‑process scheduler
 for platforms like Render/Railway.

 Key points:
 - Reads opencron.json on every tick (no DB/KV). Changes require a redeploy in prod.
 - Evaluates 5‑field cron (minute hour dayOfMonth month dayOfWeek) or 6‑field with seconds (sec minute hour dom mon dow) in UTC.
 - Executes GET requests for entries matching the current time.
 - Provides a per‑URL per‑minute and per‑second de‑dup guard.
 - Does NOT rely on vercel.json or any external cron provider.

 Start locally with logs: npm run dev (nodemon)
 Start in production:    npm start
*/

const express = require("express");
const next = require("next");
const fs = require("node:fs/promises");
const path = require("node:path");
const { exec } = require("node:child_process");

const dev = process.env.NODE_ENV !== "production";
const port = process.env.PORT || 3000;
const app = next({ dev });
const handle = app.getRequestHandler();
const STATE_PATH = process.env.OPENCRON_STATE_PATH || "";

// Logs configuration
const LOGS_DIR = process.env.LOGS_DIR || path.join(process.cwd(), "logs");
const LOGS_RETENTION_DAYS = Number(process.env.LOGS_RETENTION_DAYS || "7");
const LOGS_MAX_ENTRIES = Number(process.env.LOGS_MAX_ENTRIES || "2000");
const LOG_SNIPPET_LIMIT = Number(process.env.LOG_SNIPPET_LIMIT || "1024");

// ---- Cron utilities (standalone JS copy) ----
/** Returns true if n is an integer in [min, max]. */
function numberInRange(n, min, max) {
  return Number.isInteger(n) && n >= min && n <= max;
}

/** Validates one cron field (supports wildcard '*', step syntax 'star-slash-n', ranges, and lists). */
function validateCronField(part, min, max) {
  const segments = String(part).split(",");
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

/** Validates that an expression has 5 or 6 fields and each is syntactically valid. */
function isValidCronExpression(expr) {
  const parts = String(expr).trim().split(/\s+/);
  if (parts.length !== 5 && parts.length !== 6) return false;
  const [maybeSec, min, hour, dom, mon, dow] =
    parts.length === 6 ? parts : ["0", parts[0], parts[1], parts[2], parts[3], parts[4]];
  return (
    validateCronField(maybeSec, 0, 59) &&
    validateCronField(min, 0, 59) &&
    validateCronField(hour, 0, 23) &&
    validateCronField(dom, 1, 31) &&
    validateCronField(mon, 1, 12) &&
    validateCronField(dow, 0, 7)
  );
}

/** Returns true if a field contains a specific numeric value. */
function fieldIncludes(part, value, min, max) {
  const segments = String(part).split(",");
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
 * Returns true if expr matches the given Date (UTC). Day‑of‑month and
 * day‑of‑week fields are ORed (common cron behavior).
 */
function cronMatchesDate(expr, d) {
  if (!isValidCronExpression(expr)) return false;
  const parts = String(expr).trim().split(/\s+/);
  const [secS, minS, hourS, domS, monS, dowS] =
    parts.length === 6 ? parts : ["0", parts[0], parts[1], parts[2], parts[3], parts[4]];
  const second = d.getUTCSeconds();
  const minute = d.getUTCMinutes();
  const hour = d.getUTCHours();
  const dom = d.getUTCDate();
  const mon = d.getUTCMonth() + 1;
  const dow = d.getUTCDay(); // 0..6

  const s = fieldIncludes(secS, second, 0, 59);
  const m = fieldIncludes(minS, minute, 0, 59);
  const h = fieldIncludes(hourS, hour, 0, 23);
  const dm = fieldIncludes(domS, dom, 1, 31);
  const mo = fieldIncludes(monS, mon, 1, 12);
  const normDow = dow === 0 ? 0 : dow; // allow 0/7 as Sunday
  const dw = fieldIncludes(dowS.replace(/(?<!\d)7(?!\d)/g, "0"), normDow, 0, 7);
  return s && m && h && mo && (dm || dw);
}

/** Reads and minimally validates opencron.json; returns an array of {url,schedule}. */
async function readOpenCronConfig() {
  const filePath = path.join(process.cwd(), "opencron.json");
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const json = JSON.parse(raw);
    if (!Array.isArray(json?.crons)) return [];
    return json.crons
      .filter((c) => typeof c?.url === "string" && typeof c?.schedule === "string")
      .map((c) => ({ url: c.url, schedule: c.schedule }));
  } catch (e) {
    console.warn("[OpenCron] opencron.json not found or invalid");
    return [];
  }
}

/** Performs a GET request with a short timeout and basic headers. */
async function doRequest(url) {
  // Helper functions for file-based logs
  function hostnameFromUrl(u) {
    try {
      return new URL(u).hostname;
    } catch (_) {
      return String(u).replace(/[^a-z0-9.-]/gi, "-").toLowerCase();
    }
  }

  async function ensureLogsDir() {
    try {
      await fs.mkdir(LOGS_DIR, { recursive: true });
    } catch (_) {}
  }

  async function atomicWriteFile(filePath, data) {
    const tmp = filePath + ".tmp." + Date.now() + "." + Math.random().toString(36).slice(2);
    await fs.writeFile(tmp, JSON.stringify(data, null, 2) + "\n", "utf8");
    await fs.rename(tmp, filePath);
  }

  async function appendLogFile(u, entry) {
    try {
      await ensureLogsDir();
      const host = hostnameFromUrl(u);
      const file = path.join(LOGS_DIR, `${host}.json`);
      let obj = { meta: { url: u, host, createdAt: Date.now() }, entries: [] };
      try {
        const raw = await fs.readFile(file, "utf8");
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.entries)) obj = parsed;
      } catch (_) {}
      obj.entries = obj.entries || [];
      obj.entries.push(entry);
      const cutoff = Date.now() - LOGS_RETENTION_DAYS * 24 * 60 * 60 * 1000;
      obj.entries = obj.entries.filter((e) => e && e.ts && e.ts >= cutoff);
      if (obj.entries.length > LOGS_MAX_ENTRIES) obj.entries = obj.entries.slice(-LOGS_MAX_ENTRIES);
      await atomicWriteFile(file, obj);
    } catch (err) {
      console.warn("[OpenCron] Failed to write log file:", err?.message || err);
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { "User-Agent": "OpenCron-Server/1.0", "X-OpenCron": "1" },
      cache: "no-store",
      signal: controller.signal,
    });
    let snippet = null;
    try {
      const text = await res.text();
      if (typeof text === "string") snippet = text.slice(0, LOG_SNIPPET_LIMIT);
    } catch (_) {}
    const duration = Date.now() - start;
    const entry = { ts: Date.now(), status: res.status, ok: !!res.ok, durationMs: duration, bodySnippet: snippet };
    try {
      const key = url;
      const arr = Array.isArray(persistedState.logsByUrl[key]) ? persistedState.logsByUrl[key] : [];
      arr.push({ ts: entry.ts, status: entry.status, ok: entry.ok, durationMs: entry.durationMs });
      if (arr.length > 50) arr.splice(0, arr.length - 50);
      persistedState.logsByUrl[key] = arr;
    } catch (_) {}
    // append to per-host file
    await appendLogFile(url, entry);
    if (!res.ok) {
      console.warn("[OpenCron] Non-2xx:", url, res.status);
    } else {
      console.log("[OpenCron] OK:", url, res.status, `${duration}ms`);
    }
  } catch (e) {
    const duration = Date.now() - start;
    console.warn("[OpenCron] Request failed:", url, e?.message || e);
    try {
      const key = url;
      const arr = Array.isArray(persistedState.logsByUrl[key]) ? persistedState.logsByUrl[key] : [];
      arr.push({ ts: Date.now(), status: 0, ok: false, error: String(e?.message || e) });
      if (arr.length > 50) arr.splice(0, arr.length - 50);
      persistedState.logsByUrl[key] = arr;
    } catch (_) {}
    const entry = { ts: Date.now(), status: 0, ok: false, durationMs: duration, error: String(e?.message || e) };
    await appendLogFile(url, entry);
  } finally {
    clearTimeout(timeout);
  }
}

// ---- Optional persisted state (per-URL last run keys and recent logs) ----
let persistedState = { lastMinuteByUrl: {}, lastSecondByUrl: {}, logsByUrl: {} };
let stateLoaded = false;

async function loadState() {
  if (!STATE_PATH || stateLoaded) return;
  try {
    const raw = await fs.readFile(STATE_PATH, "utf8");
    const json = JSON.parse(raw);
    if (json && json.lastMinuteByUrl && typeof json.lastMinuteByUrl === "object") {
      persistedState.lastMinuteByUrl = json.lastMinuteByUrl;
    }
    if (json && json.lastSecondByUrl && typeof json.lastSecondByUrl === "object") {
      persistedState.lastSecondByUrl = json.lastSecondByUrl;
    }
    if (json && json.logsByUrl && typeof json.logsByUrl === "object") {
      persistedState.logsByUrl = json.logsByUrl;
    }
    stateLoaded = true;
    console.log("[OpenCron] Loaded state from", STATE_PATH);
  } catch (e) {
    // First run or missing file is fine
    stateLoaded = true;
  }
}

async function saveState() {
  if (!STATE_PATH) return;
  try {
    await fs.mkdir(path.dirname(STATE_PATH), { recursive: true });
    await fs.writeFile(STATE_PATH, JSON.stringify(persistedState, null, 2) + "\n", "utf8");
  } catch (e) {
    console.warn("[OpenCron] Failed to save state:", e?.message || e);
  }
}

/**
 * Starts a minute‑aligned scheduler that:
 * - Aligns to the next minute boundary
 * - On each minute: reads config, matches cron, fires GETs, and de‑dups per URL
 * Returns a cancel function for the initial alignment timeout.
 */
function startMinuteAlignedScheduler() {
  if (process.env.CRON_DISABLED === "1") {
    console.log("[OpenCron] In-process scheduler disabled via CRON_DISABLED=1");
    return () => {};
  }
  const lastMinuteByUrl = new Map();
  const lastSecondByUrl = new Map();

  const tickSeconds = async () => {
    const now = new Date();
    const secondKey = Math.floor(now.getTime() / 1000);
    await loadState();
    const crons = await readOpenCronConfig();
    await Promise.all(
      crons
        .filter((c) => String(c.schedule).trim().split(/\s+/).length === 6)
        .map(async ({ url, schedule }) => {
          try {
            if (!cronMatchesDate(schedule, now)) return;
            const last = lastSecondByUrl.get(url) ?? persistedState.lastSecondByUrl[url];
            if (last === secondKey) return;
            await doRequest(url);
            lastSecondByUrl.set(url, secondKey);
            persistedState.lastSecondByUrl[url] = secondKey;
          } catch (_) {}
        })
    );
    await saveState();
  };

  const tickMinutes = async () => {
    const now = new Date();
    const minuteKey = Math.floor(now.getTime() / 60000);
    await loadState();
    const crons = await readOpenCronConfig();
    await Promise.all(
      crons
        .filter((c) => String(c.schedule).trim().split(/\s+/).length !== 6)
        .map(async ({ url, schedule }) => {
          try {
            if (!cronMatchesDate(schedule, now)) return;
            const last = lastMinuteByUrl.get(url) ?? persistedState.lastMinuteByUrl[url];
            if (last === minuteKey) return;
            await doRequest(url);
            lastMinuteByUrl.set(url, minuteKey);
            persistedState.lastMinuteByUrl[url] = minuteKey;
          } catch (_) {}
        })
    );
    await saveState();
  };

  const now = Date.now();
  // Seconds loop (disable with CRON_SECONDS_DISABLED=1)
  let secInterval = null;
  if (process.env.CRON_SECONDS_DISABLED !== "1") {
    const msToNextSecond = 1000 - (now % 1000);
    setTimeout(() => {
      tickSeconds();
      secInterval = setInterval(tickSeconds, 1000);
    }, msToNextSecond);
  }

  // Minutes loop (always on)
  const msToNextMinute = 60000 - (now % 60000);
  const minuteTimeout = setTimeout(() => {
    tickMinutes();
    const minInterval = setInterval(tickMinutes, 60_000);
    process.on("SIGTERM", () => clearInterval(minInterval));
    process.on("SIGINT", () => clearInterval(minInterval));
  }, msToNextMinute);

  return () => {
    clearTimeout(minuteTimeout);
    if (secInterval) clearInterval(secInterval);
  };
}

async function ensurePortFree(targetPort) {
  const isWin = process.platform === "win32";

  function listPidsOnce() {
    return new Promise((resolve) => {
      if (isWin) {
        // Windows: parse netstat output; last column is PID
        exec(`netstat -ano -p tcp | findstr :${targetPort}`, { windowsHide: true, shell: true }, (err, stdout) => {
          const pids = new Set();
          if (!err && stdout) {
            String(stdout)
              .split(/\r?\n/)
              .map((l) => l.trim())
              .filter(Boolean)
              .forEach((line) => {
                const parts = line.split(/\s+/);
                const maybePid = parts[parts.length - 1];
                const n = parseInt(maybePid, 10);
                if (Number.isFinite(n) && n > 0 && n !== process.pid) pids.add(n);
              });
          }
          resolve(Array.from(pids));
        });
      } else {
        // Unix/macOS: lsof
        exec(`lsof -ti tcp:${targetPort} -sTCP:LISTEN || true`, (err, stdout) => {
          const pids = String(stdout)
            .split(/\s+/)
            .map((s) => parseInt(s, 10))
            .filter((n) => Number.isFinite(n) && n > 0 && n !== process.pid);
          resolve(pids);
        });
      }
    });
  }

  async function killPids(pids) {
    if (!pids || pids.length === 0) return;
    console.log(`[OpenCron] Detected processes on port ${targetPort}: ${pids.join(", ")}. Attempting to terminate...`);
    for (const pid of pids) {
      try {
        process.kill(pid, "SIGTERM");
      } catch (_) {}
    }
    // Give them a moment
    await new Promise((r) => setTimeout(r, 350));
    for (const pid of pids) {
      try {
        process.kill(pid, 0); // still alive?
        if (isWin) {
          exec(`taskkill /PID ${pid} /T /F`, { windowsHide: true }, () => {});
        } else {
          process.kill(pid, "SIGKILL");
        }
      } catch (_) {}
    }
  }

  const maxTries = 6;
  for (let i = 0; i < maxTries; i++) {
    const pids = await listPidsOnce();
    if (!pids || pids.length === 0) return;
    await killPids(pids);
    await new Promise((r) => setTimeout(r, 250));
  }
}

(async () => {
  await ensurePortFree(port);
  await app.prepare();

  const server = express();
  server.get("/healthz", (_req, res) => res.status(200).send("ok"));
  server.all("*", (req, res) => handle(req, res));
  server.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
    startMinuteAlignedScheduler();
  });
})();
