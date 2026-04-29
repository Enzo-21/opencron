/**
 * Human-readable translations for simple 5-field cron expressions (UTC-based).
 * Handles common patterns; falls back to a compact description when complex.
 */

const DOW_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MON_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function isNumStr(s: string) {
  if (!/^\d+$/.test(s)) return false;
  const n = Number(s);
  return Number.isInteger(n);
}

function parseStep(part: string): number | null {
  if (part.startsWith("*/")) {
    const n = Number(part.slice(2));
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
}

function describeDow(part: string): string {
  if (part === "*") return "every day of week";
  const step = parseStep(part);
  if (step) return `every ${step} day(s) of week`;
  if (part.includes("-")) {
    const [a, b] = part.split("-");
    if (isNumStr(a) && isNumStr(b)) {
      const ai = Number(a) % 7;
      const bi = Number(b) % 7;
      return `${DOW_NAMES[ai]}–${DOW_NAMES[bi]}`;
    }
  }
  const list = part.split(",").map((x) => (isNumStr(x) ? DOW_NAMES[Number(x) % 7] : x));
  if (list.length === 1) return list[0] || part;
  if (list.length === 2) return `${list[0]} and ${list[1]}`;
  return `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`;
}

function describeDom(part: string): string {
  if (part === "*") return "every day";
  const step = parseStep(part);
  if (step) return `every ${step} day(s)`;
  if (part.includes("-")) {
    const [a, b] = part.split("-");
    if (isNumStr(a) && isNumStr(b)) {
      return `days ${a}–${b}`;
    }
  }
  const list = part.split(",");
  if (list.length === 1 && isNumStr(list[0])) return `day ${list[0]}`;
  return `days ${list.join(", ")}`;
}

function describeMon(part: string): string {
  if (part === "*") return "every month";
  const step = parseStep(part);
  if (step) return `every ${step} month(s)`;
  if (part.includes("-")) {
    const [a, b] = part.split("-");
    if (isNumStr(a) && isNumStr(b)) {
      const ai = (Number(a) - 1) % 12;
      const bi = (Number(b) - 1) % 12;
      return `${MON_NAMES[ai]}–${MON_NAMES[bi]}`;
    }
  }
  const list = part
    .split(",")
    .map((x) => (isNumStr(x) ? MON_NAMES[(Number(x) - 1) % 12] : x));
  if (list.length === 1) return list[0] || part;
  if (list.length === 2) return `${list[0]} and ${list[1]}`;
  return `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`;
}

export function translateCron(expr: string): string {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5 && parts.length !== 6) return "Invalid cron";
  const [sec, min, hour, dom, mon, dow] =
    parts.length === 6 ? parts : ["0", parts[0], parts[1], parts[2], parts[3], parts[4]];

  const minStep = parseStep(min);
  const hourStep = parseStep(hour);
  const secStep = parseStep(sec);

  // Pure frequency-based schedules (no specific day/month constraints)
  const noDayConstraints = dom === "*" && mon === "*" && dow === "*";
  if (noDayConstraints && sec === "*" && min === "*" && hour === "*") return "Every second";
  if (noDayConstraints && secStep && min === "*" && hour === "*") return `Every ${secStep} seconds`;
  if (noDayConstraints && isNumStr(sec) && min === "*" && hour === "*")
    return `Every minute at :${pad2(Number(sec))} UTC`;
  if (noDayConstraints) {
    if (min === "*" && hour === "*") return "Every minute";
    if (minStep && hour === "*") return `Every ${minStep} minutes`;
    if (isNumStr(min) && hour === "*") return `Every hour at :${pad2(Number(min))} UTC`;
    if (min === "0" && hourStep) return `Every ${hourStep} hours`;
    if (isNumStr(min) && hourStep)
      return `Every ${hourStep} hours at :${pad2(Number(min))} UTC`;
    if (isNumStr(min) && isNumStr(hour))
      return `Every day at ${pad2(Number(hour))}:${pad2(Number(min))}:${pad2(Number(sec))} UTC`;
    if (min === "*" && isNumStr(hour))
      return `Every minute during ${pad2(Number(hour))}:00 UTC hour`;
    return `Cron ${expr} (UTC)`;
  }

  // Day-of-week driven (no day-of-month)
  if (dom === "*" && dow !== "*") {
    const dowText = describeDow(dow);
    if (isNumStr(min) && isNumStr(hour))
      return `Every ${dowText} at ${pad2(Number(hour))}:${pad2(Number(min))}:${pad2(Number(sec))} UTC`;
    if (minStep && hour === "*") return `Every ${minStep} minutes on ${dowText}`;
    if (min === "0" && hourStep) return `Every ${hourStep} hours on ${dowText}`;
    return `On ${dowText} (UTC)`;
  }

  // Day-of-month driven (no day-of-week)
  if (dow === "*" && dom !== "*") {
    const domText = describeDom(dom);
    const monText = describeMon(mon);
    if (isNumStr(min) && isNumStr(hour))
      return `On ${domText} in ${monText} at ${pad2(Number(hour))}:${pad2(Number(min))}:${pad2(Number(sec))} UTC`;
    return `On ${domText} in ${monText} (UTC)`;
  }

  // Both DOM and DOW specified: OR semantics
  const domText = describeDom(dom);
  const dowText = describeDow(dow);
  if (isNumStr(min) && isNumStr(hour))
    return `On ${domText} or ${dowText} at ${pad2(Number(hour))}:${pad2(Number(min))}:${pad2(Number(sec))} UTC`;
  return `On ${domText} or ${dowText} (UTC)`;
}
