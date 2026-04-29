"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { isValidCronExpression, cronMatchesDate, nextRunDate } from "@/lib/cron-core";

type Props = {
  url: string;
  schedule: string;
};

function formatDiff(ms: number): string {
  if (ms <= 0) return "now";
  const s = Math.floor(ms / 1000);
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export default function CronTimer({ url, schedule }: Props) {
  const valid = isValidCronExpression(schedule);
  const hasSeconds = useMemo(() => valid && schedule.trim().split(/\s+/).length === 6, [valid, schedule]);
  const [now, setNow] = useState<number>(Date.now());
  const [lastRunMs, setLastRunMs] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);
  const lastSeenRef = useRef<number | null>(null);

  // Ticking clock
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  // Poll server status for last run timestamp if available
  useEffect(() => {
    let stopped = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/cron/status`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const ms = data?.last?.[url];
        if (typeof ms === "number" && !stopped) {
          setLastRunMs((prev) => {
            if (prev == null || ms > prev) {
              // New successful run observed; flash success
              setFlash(true);
              setTimeout(() => setFlash(false), 1200);
              lastSeenRef.current = ms;
              return ms;
            }
            return prev;
          });
        }
      } catch {}
    };
    const iv = setInterval(poll, 1000);
    poll();
    return () => {
      stopped = true;
      clearInterval(iv);
    };
  }, [url]);

  const next = useMemo(() => {
    if (!valid) return null;
    return nextRunDate(schedule, new Date(now));
  }, [schedule, valid, now]);

  if (!valid) return <span className="text-destructive">Invalid cron</span>;
  const diff = next ? next.getTime() - now : 0;

  return (
    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
      <span>
        {hasSeconds ? "Runs in" : "Next run in"} {formatDiff(Math.max(0, diff))}
      </span>
      {flash && (
        <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
            <path fillRule="evenodd" d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.25 7.333a1 1 0 0 1-1.435.006L3.29 9.602a1 1 0 1 1 1.42-1.406l3.032 3.06 6.54-6.614a1 1 0 0 1 1.422-.006Z" clipRule="evenodd" />
          </svg>
          <span>Ran</span>
        </span>
      )}
    </div>
  );
}
