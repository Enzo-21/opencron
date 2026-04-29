// Pure cron helpers for client and server usage (no fs imports).

function numberInRange(n: number, min: number, max: number) {
  return Number.isInteger(n) && n >= min && n <= max;
}

function validateCronField(part: string, min: number, max: number): boolean {
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

export function isValidCronExpression(expr: string): boolean {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5 && parts.length !== 6) return false;
  const [sec, min, hour, dom, mon, dow] =
    parts.length === 6 ? parts : ["0", parts[0], parts[1], parts[2], parts[3], parts[4]];
  return (
    validateCronField(sec, 0, 59) &&
    validateCronField(min, 0, 59) &&
    validateCronField(hour, 0, 23) &&
    validateCronField(dom, 1, 31) &&
    validateCronField(mon, 1, 12) &&
    validateCronField(dow, 0, 7)
  );
}

function fieldIncludes(part: string, value: number, min: number, max: number): boolean {
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

export function cronMatchesDate(expr: string, d: Date): boolean {
  if (!isValidCronExpression(expr)) return false;
  const parts = expr.trim().split(/\s+/);
  const [secS, minS, hourS, domS, monS, dowS] =
    parts.length === 6 ? parts : ["0", parts[0], parts[1], parts[2], parts[3], parts[4]];
  const sec = d.getUTCSeconds();
  const min = d.getUTCMinutes();
  const hour = d.getUTCHours();
  const dom = d.getUTCDate();
  const mon = d.getUTCMonth() + 1;
  const dow = d.getUTCDay();
  const s = fieldIncludes(secS, sec, 0, 59);
  const m = fieldIncludes(minS, min, 0, 59);
  const h = fieldIncludes(hourS, hour, 0, 23);
  const dm = fieldIncludes(domS, dom, 1, 31);
  const mo = fieldIncludes(monS, mon, 1, 12);
  const dw = fieldIncludes(dowS.replace(/(?<!\d)7(?!\d)/g, "0"), dow === 0 ? 0 : dow, 0, 7);
  return s && m && h && mo && (dm || dw);
}

export function nextRunDate(expr: string, from: Date): Date | null {
  if (!isValidCronExpression(expr)) return null;
  const parts = expr.trim().split(/\s+/);
  const hasSec = parts.length === 6;
  const stepMs = hasSec ? 1000 : 60_000;
  const limitIterations = hasSec ? 86400 : 10080; // 1 day of seconds; 7 days of minutes
  let t = from.getTime() + stepMs;
  // Align to boundary
  if (hasSec) t = Math.floor(t / 1000) * 1000;
  else t = Math.floor(t / 60000) * 60000;

  for (let i = 0; i < limitIterations; i++, t += stepMs) {
    const d = new Date(t);
    if (cronMatchesDate(expr, d)) return d;
  }
  return null;
}
