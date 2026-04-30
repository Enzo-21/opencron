"use client";

import { useState } from "react";
import CronCard from "@/components/CronCard";
import { deleteCron, updateCron, reorderCron } from "@/app/actions/opencron";

type Props = {
  index: number;
  url: string;
  schedule: string;
  upIndex?: number | null;
  downIndex?: number | null;
};

export default function CronItem({ index, url, schedule, upIndex = null, downIndex = null }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const isProd = (process.env.NODE_ENV || 'development') === 'production' || (process.env.NEXT_PUBLIC_APP_ENV || '') === 'production';

  if (isEditing && !isProd) {
    return (
      <form
        action={async (fd) => {
          await updateCron(fd);
          setIsEditing(false);
        }}
        className="space-y-2"
      >
        <input type="hidden" name="index" value={index} />
        <CronCard url={url} schedule={schedule} editing />
        <div className="flex items-center gap-2">
          <button
            type="submit"
            className="inline-flex h-8 items-center justify-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:opacity-90"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="inline-flex h-8 items-center justify-center rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground hover:opacity-90"
          >
            Cancel
          </button>
          <form
            action={deleteCron}
            onSubmit={(e) => {
              if (!confirm("Delete this cron? This cannot be undone.")) {
                e.preventDefault();
              }
            }}
          >
            <input type="hidden" name="index" value={index} />
            <button
              type="submit"
              className="inline-flex h-8 items-center justify-center rounded-md bg-red-600 px-3 text-xs font-medium text-white hover:opacity-90"
            >
              Delete
            </button>
          </form>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative group">
        <CronCard url={url} schedule={schedule} />
        {/* Hover controls bottom-right */}
        {!isProd && (
          <div className="pointer-events-none absolute bottom-2 right-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            title="Edit"
            aria-label="Edit"
            onClick={() => setIsEditing(true)}
            className="pointer-events-auto inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background text-foreground hover:opacity-90"
          >
            {/* Pencil icon */}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M15.728 2.272a2.5 2.5 0 0 1 3.536 3.536l-10 10A2 2 0 0 1 8.122 17H5a1 1 0 0 1-1-1v-3.122a2 2 0 0 1 .586-1.414l10-10Z"/>
              <path d="M12.5 4.5 15.5 7.5"/>
            </svg>
          </button>
          <form
            action={deleteCron}
            onSubmit={(e) => {
              if (!confirm("Delete this cron? This cannot be undone.")) {
                e.preventDefault();
              }
            }}
            className="pointer-events-auto"
          >
            <input type="hidden" name="index" value={index} />
            <button
              type="submit"
              title="Delete"
              aria-label="Delete"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-red-300 bg-red-600 text-white hover:opacity-90"
            >
              {/* Trash icon */}
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path d="M6 8a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0V9a1 1 0 0 1 1-1Zm4 0a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0V9a1 1 0 0 1 1-1Zm4 0a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0V9a1 1 0 0 1 1-1Z"/>
                <path fillRule="evenodd" d="M4 5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2h2a1 1 0 1 1 0 2h-1v9a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7H2a1 1 0 1 1 0-2h2Zm3-1a1 1 0 0 0-1 1v0h8v0a1 1 0 0 0-1-1H7Z" clipRule="evenodd"/>
              </svg>
            </button>
          </form>
          </div>
        )}
      </div>

      {(typeof upIndex === "number" || typeof downIndex === "number") && (
        <div className="flex items-center gap-2">
          {typeof upIndex === "number" && (
            <form action={reorderCron}>
              <input type="hidden" name="from" value={index} />
              <input type="hidden" name="to" value={upIndex} />
              <button
                type="submit"
                className="inline-flex h-8 items-center justify-center rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground hover:opacity-90"
              >
                ↑ Up
              </button>
            </form>
          )}
          {typeof downIndex === "number" && (
            <form action={reorderCron}>
              <input type="hidden" name="from" value={index} />
              <input type="hidden" name="to" value={downIndex} />
              <button
                type="submit"
                className="inline-flex h-8 items-center justify-center rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground hover:opacity-90"
              >
                Down ↓
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
