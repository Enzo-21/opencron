"use client";

import { useEffect, useState } from "react";

type StatusResp = { last?: Record<string, number> };

const POLL_MS = 10000;

let subscribers: Map<string, Set<(ms: number | null) => void>> = new Map();
let timer: number | undefined;
let latest: StatusResp = { last: {} };

async function poll() {
  try {
    const res = await fetch("/api/cron/status", { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as StatusResp;
    latest = data ?? { last: {} };
    subscribers.forEach((set, url) => {
      const ms = latest?.last?.[url] ?? null;
      set.forEach((cb) => {
        try {
          cb(ms);
        } catch {}
      });
    });
  } catch {}
}

function start() {
  if (timer !== undefined) return;
  timer = window.setInterval(poll, POLL_MS) as unknown as number;
  poll();
}

function stop() {
  if (timer === undefined) return;
  clearInterval(timer);
  timer = undefined;
}

export function subscribeCronStatus(url: string, cb: (ms: number | null) => void) {
  let set = subscribers.get(url);
  if (!set) {
    set = new Set();
    subscribers.set(url, set);
  }
  set.add(cb);
  const ms = latest?.last?.[url] ?? null;
  cb(ms);
  start();
  return () => {
    const s = subscribers.get(url);
    if (!s) return;
    s.delete(cb);
    if (s.size === 0) subscribers.delete(url);
    if (subscribers.size === 0) stop();
  };
}

export default function useCronStatus(url?: string) {
  const [last, setLast] = useState<number | null>(() => (typeof window !== "undefined" && url ? latest?.last?.[url] ?? null : null));
  useEffect(() => {
    if (!url) return;
    const unsub = subscribeCronStatus(url, setLast);
    return unsub;
  }, [url]);
  return last;
}
