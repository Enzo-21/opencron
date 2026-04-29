"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

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
                {logs.map((l, i) => {
                  const key = `${l.ts}-${i}`;
                  const bodyText = l.error ?? (l as any).bodySnippet ?? "";
                  const isError = Boolean(l.error);
                  const PREVIEW_LEN = 200;
                  const preview = bodyText.length > PREVIEW_LEN ? bodyText.slice(0, PREVIEW_LEN) + "…" : bodyText;
                  return (
                    <li key={key} className="space-y-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <span className="tabular-nums text-muted-foreground">{new Date(l.ts).toLocaleString()}</span>
                          <span className={l.ok ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                            {l.ok ? `OK ${l.status}` : l.status ? `ERR ${l.status}` : "ERR"}
                          </span>
                        </div>
                        <div className="text-muted-foreground text-[11px]">{typeof l.durationMs === 'number' ? `${l.durationMs}ms` : ''}</div>
                      </div>

                      {bodyText ? (
                        <div className="rounded-md border border-border bg-background p-2 text-[12px] text-foreground">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              {!expanded[key] ? (
                                <div className={isError ? "text-red-600 dark:text-red-400 whitespace-pre-wrap break-words" : "text-muted-foreground whitespace-pre-wrap break-words"}>
                                  {preview || <span className="text-muted-foreground">No response</span>}
                                </div>
                              ) : (
                                <div className={isError ? "text-red-600 dark:text-red-400 whitespace-pre-wrap break-words" : "whitespace-pre-wrap break-words"}>
                                  {isError ? <div className="text-red-600 dark:text-red-400">{bodyText}</div> : <pre className="whitespace-pre-wrap break-words text-[12px]">{bodyText}</pre>}
                                </div>
                              )}
                            </div>
                            <div className="flex-shrink-0">
                              <Button variant="ghost" size="sm" onClick={() => setExpanded((p) => ({ ...p, [key]: !p[key] }))}>
                                {expanded[key] ? "Hide response" : "See response"}
                              </Button>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
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
