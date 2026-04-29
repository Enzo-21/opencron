"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import CronItem from "@/components/CronItem";
import { reorderCronBulk } from "@/app/actions/opencron";

type Cron = { url: string; schedule: string };

function getDomain(u: string): string {
  try {
    return new URL(u).host;
  } catch {
    return "";
  }
}

function getDomainIconUrl(domain: string): string {
  // Lightweight, public icon service
  if (!domain) return "";
  return `https://icons.duckduckgo.com/ip3/${domain}.ico`;
}

type Props = {
  crons: Cron[];
};

export default function CronList({ crons }: Props) {
  const [groupByDomain, setGroupByDomain] = useState(true);
  const [sortAlpha, setSortAlpha] = useState(true);
  const [reorderMode, setReorderMode] = useState(false);
  const [localOrder, setLocalOrder] = useState<Array<{ idx: number; item: Cron }>>([]);
  const dragFrom = useRef<number | null>(null);

  useEffect(() => {
    if (reorderMode) {
      setLocalOrder(crons.map((c, i) => ({ idx: i, item: c })));
    } else {
      setLocalOrder([]);
    }
  }, [reorderMode, crons]);

  const content = useMemo(() => {
    if (reorderMode) {
      const onDragStart = (i: number) => (e: React.DragEvent) => {
        dragFrom.current = i;
        e.dataTransfer.effectAllowed = "move";
      };
      const onDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      };
      const onDrop = (to: number) => (e: React.DragEvent) => {
        e.preventDefault();
        const from = dragFrom.current;
        dragFrom.current = null;
        if (from == null || from === to) return;
        setLocalOrder((prev) => {
          const next = [...prev];
          const [moved] = next.splice(from, 1);
          next.splice(to, 0, moved);
          return next;
        });
      };

      const orderCsv = localOrder.map((x) => x.idx).join(",");

      return (
        <div className="space-y-3">
          <div className="rounded-md border border-dashed border-border p-2 text-xs text-muted-foreground">
            Drag and drop to reorder. Click “Save Order” to persist.
          </div>
          <ul className="flex flex-col gap-2">
            {localOrder.map(({ item, idx }, i) => (
              <li
                key={`${item.url}-${idx}`}
                draggable
                onDragStart={onDragStart(i)}
                onDragOver={onDragOver}
                onDrop={onDrop(i)}
                className="cursor-move rounded-md border border-border bg-card p-2"
              >
                <CronItem index={idx} url={item.url} schedule={item.schedule} />
              </li>
            ))}
          </ul>
          <form action={reorderCronBulk} className="flex items-center gap-2">
            <input type="hidden" name="order" value={orderCsv} />
            <button
              type="submit"
              className="inline-flex h-8 items-center justify-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:opacity-90"
            >
              Save Order
            </button>
          </form>
        </div>
      );
    }

    // Display mode: group/sort purely for UI, no reordering controls
    const items = sortAlpha
      ? [...crons].sort((a, b) => a.url.localeCompare(b.url))
      : crons;

    if (!groupByDomain) {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((c, i) => (
            <CronItem key={`${c.url}-${i}`} index={i} url={c.url} schedule={c.schedule} />
          ))}
        </div>
      );
    }

    const groups = new Map<string, Array<{ idx: number; item: Cron }>>();
    items.forEach((c, i) => {
      const d = getDomain(c.url);
      const arr = groups.get(d) ?? [];
      arr.push({ idx: i, item: c });
      groups.set(d, arr);
    });

    return (
      <div className="space-y-6">
        {Array.from(groups.entries()).map(([domain, list]) => {
          const iconUrl = getDomainIconUrl(domain);
          return (
            <section key={domain} className="space-y-3">
              <div className="flex items-center gap-2">
                {iconUrl ? (
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-primary">
                    <img
                      src={iconUrl}
                      width={16}
                      height={16}
                      alt=""
                      aria-hidden
                      className="h-4 w-4 rounded-sm"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                        const parent = (e.currentTarget.parentElement as HTMLElement) ?? null;
                        if (parent) parent.style.display = "none";
                      }}
                    />
                  </span>
                ) : null}
                <h3 className="text-sm font-semibold text-foreground">{domain || "(unknown)"}</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {list.map(({ item, idx }) => (
                  <CronItem key={`${item.url}-${idx}`} index={idx} url={item.url} schedule={item.schedule} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    );
  }, [crons, groupByDomain, sortAlpha, reorderMode]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={groupByDomain}
            disabled={reorderMode}
            onChange={(e) => setGroupByDomain(e.target.checked)}
          />
          Group by domain
        </label>
        <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={sortAlpha}
            disabled={reorderMode}
            onChange={(e) => setSortAlpha(e.target.checked)}
          />
          Sort A→Z
        </label>
        <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={reorderMode}
            onChange={(e) => setReorderMode(e.target.checked)}
          />
          Reorder mode
        </label>
      </div>
      {content}
    </div>
  );
}
