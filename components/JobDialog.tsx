"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { translateCron } from "@/lib/cron-translator";

type Props = {
  url: string;
  schedule: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

type LogEntry = { ts: number; status: number; ok: boolean; durationMs?: number; bodySnippet?: string; error?: string };

export default function JobDialog({ url, schedule, open, onOpenChange }: Props) {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    if (!open) return;
    let stop = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/cron/logs?url=${encodeURIComponent(url)}`, { cache: "no-store" });
        const data = await res.json();
        if (!stop && Array.isArray(data?.logs)) setLogs(data.logs.reverse());
      } catch {}
    };
    load();
    const iv = setInterval(load, 5000);
    return () => {
      stop = true;
      clearInterval(iv);
    };
  }, [open, url]);

  const human = translateCron(schedule);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="truncate">{url}</DialogTitle>
          <DialogDescription className="text-xs">{schedule} • {human}</DialogDescription>
        </DialogHeader>
        <div className="mt-4 space-y-2">
          <div className="text-xs text-muted-foreground">Recent runs</div>
          <div className="max-h-64 overflow-auto rounded-md border border-border bg-card p-2">
            {logs.length === 0 ? (
              <div className="text-xs text-muted-foreground">No logs yet.</div>
            ) : (
              <ul className="space-y-2 text-xs">
                {logs.map((l, i) => (
                  <li key={`${l.ts}-${i}`} className="space-y-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <span className="tabular-nums text-muted-foreground">{new Date(l.ts).toLocaleString()}</span>
                        <span className={l.ok ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                          {l.ok ? `OK ${l.status}` : l.status ? `ERR ${l.status}` : "ERR"}
                        </span>
                      </div>
                      <div className="text-muted-foreground text-[11px]">{typeof l.durationMs === 'number' ? `${l.durationMs}ms` : ''}</div>
                    </div>
                    {(l.error || (l as any).bodySnippet) && (
                      <div className="rounded-md border border-border bg-background p-2 text-[12px] text-foreground">
                        {l.error ? (
                          <div className="text-red-600 dark:text-red-400">{l.error}</div>
                        ) : (
                          <pre className="whitespace-pre-wrap break-words text-[12px]">{(l as any).bodySnippet}</pre>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex items-center gap-2 pt-2">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center justify-center rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground hover:opacity-90"
            >
              Open URL
            </a>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(url)}
              className="inline-flex h-8 items-center justify-center rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground hover:opacity-90"
            >
              Copy URL
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
