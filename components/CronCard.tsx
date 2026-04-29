import { translateCron } from "@/lib/cron-translator";
import { useState } from "react";
import CronTimer from "@/components/CronTimer";
import JobDialog from "@/components/JobDialog";

type Props = {
  url: string;
  schedule: string;
  editing?: boolean;
};

export default function CronCard({ url, schedule, editing = false }: Props) {
  const human = translateCron(schedule);
  const [open, setOpen] = useState(false);
  return (
    <div
      className={
        "relative rounded-xl border border-border bg-card p-4 shadow-sm transition-colors " +
        (editing ? "" : "hover:border-primary cursor-pointer")
      }
      onClick={!editing ? () => setOpen(true) : undefined}
    >
      {/* Cron badge/input in top-right */}
      {editing ? (
        <input
          name="schedule"
          defaultValue={schedule}
          required
          className="absolute top-2 right-2 whitespace-nowrap font-mono text-xs px-2 py-1 border border-border bg-card text-foreground rounded-tr-md rounded-bl-md rounded-tl-none rounded-br-none shadow-sm"
          placeholder="*/5 * * * *"
        />
      ) : (
        <span className="absolute top-2 right-2 inline-flex items-center whitespace-nowrap font-mono rounded-tr-md rounded-bl-md rounded-tl-none rounded-br-none bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
          {schedule}
        </span>
      )}

      {/* URL row (reserve space for badge with right padding) */}
      <div className="pr-28">
        {editing ? (
          <input
            name="url"
            type="url"
            defaultValue={url}
            required
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
        ) : (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-foreground hover:underline break-all"
          >
            {url}
          </a>
        )}
      </div>

      <div className="mt-2 text-xs text-muted-foreground">{human}</div>
      <CronTimer url={url} schedule={schedule} />
      {!editing && (
        <JobDialog url={url} schedule={schedule} open={open} onOpenChange={setOpen} />
      )}
    </div>
  );
}
