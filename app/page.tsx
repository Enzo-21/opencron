import { readOpenCronConfig } from "@/lib/opencron";
import CronCard from "@/components/CronCard";
import { addCron } from "@/app/actions/opencron";
import CronItem from "@/components/CronItem";
import CronList from "@/components/CronList";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import ProductionFooter from "@/components/ProductionFooter";

export default async function Home() {
  const { config, errors } = await readOpenCronConfig();
  const hasFile = !!config;
  const crons = config?.crons ?? [];
  const isProd = (process.env.NODE_ENV || 'development') === 'production' || (process.env.NEXT_PUBLIC_APP_ENV || '') === 'production';

  return (
    <div className="flex min-h-[100dvh] flex-col font-sans">
      <header className="border-b border-border bg-background/70 backdrop-blur">
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-foreground">OpenCron</h1>
          <div className="flex items-center gap-3">
            <ThemeSwitcher />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
        {!hasFile ? (
          <div className="rounded-xl border border-dashed border-border p-8 bg-card">
            <h2 className="text-lg font-medium text-foreground mb-2">No opencron.json found</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Add an <span className="font-mono">opencron.json</span> file at the project root. Here’s a sample to get started:
            </p>
            <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-xs text-foreground"><code>{`{
  "crons": [
    { "url": "https://example.com/api/orders/refund", "schedule": "*/1 * * * 1-5" }
  ]
}`}</code></pre>
            <div className="mt-6">
              <h3 className="text-sm font-medium text-foreground mb-2">Create your first cron</h3>
              {!isProd ? (
                <form action={addCron} className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <label className="block text-xs text-muted-foreground mb-1">URL</label>
                    <input
                      name="url"
                      type="url"
                      placeholder="https://example.com/api/task"
                      required
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                    />
                  </div>
                  <div className="sm:w-64">
                    <label className="block text-xs text-muted-foreground mb-1">Schedule</label>
                    <input
                      name="schedule"
                      type="text"
                      placeholder="*/5 * * * *"
                      required
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                    />
                  </div>
                  <button
                    type="submit"
                    className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
                  >
                    Add Cron
                  </button>
                </form>
              ) : (
                <div className="mt-2 text-sm text-muted-foreground">
                  Modifying cron jobs is disabled in production. Edit <span className="font-mono">opencron.json</span> locally and push changes.
                </div>
              )}
            </div>
            {errors?.length ? (
              <div className="mt-4 text-sm text-red-600 dark:text-red-400">
                {errors.map((e, i) => (
                  <div key={i}>• {e}</div>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="rounded-xl border border-border bg-card p-4">
              {!isProd ? (
                <form action={addCron} className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <label className="block text-xs text-muted-foreground mb-1">URL</label>
                    <input
                      name="url"
                      type="url"
                      placeholder="https://example.com/api/task"
                      required
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                    />
                  </div>
                  <div className="sm:w-64">
                    <label className="block text-xs text-muted-foreground mb-1">Schedule</label>
                    <input
                      name="schedule"
                      type="text"
                      placeholder="*/5 * * * *"
                      required
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                    />
                  </div>
                  <button
                    type="submit"
                    className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
                  >
                    Add Cron
                  </button>
                </form>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Modifying cron jobs is disabled in production. Edit <span className="font-mono">opencron.json</span> locally and push changes.
                </div>
              )}
            </div>
            {errors?.length ? (
              <div className="rounded-lg border border-red-300/50 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30 p-4 text-sm text-red-700 dark:text-red-300">
                {errors.map((e, i) => (
                  <div key={i}>• {e}</div>
                ))}
              </div>
            ) : null}
            <CronList crons={crons} />
          </div>
        )}
      </main>
      <footer className="border-t border-border">
        <div className="mx-auto max-w-5xl px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              Cron expressions are parsed elsewhere; this UI only displays them.
            </div>
            <ProductionFooter />
          </div>
        </div>
      </footer>
    </div>
  );
}
