OpenCron — JSON-driven HTTP cron runner (Next.js + Express)
================================================================

OpenCron lets you define HTTP cron jobs in a simple `opencron.json` file and provides:
- A small UI to add/edit/delete jobs (local only)
- A minute-aligned Express scheduler that reads `opencron.json` and executes due jobs (UTC)

Quick start
- Requirements: Node 18+, npm
- Install and run the custom dev server (with logs):

```bash
npm install
npm run dev
```

Open http://localhost:3000. If `opencron.json` is missing, the UI will prompt you to create your first job.
Dev uses nodemon for auto-restart of the Express server. It watches `server.js` and `opencron.json`, so edits to either will restart the server. You’ll see scheduler logs in your terminal. Set `CRON_DISABLED=1` to pause it:

```bash
CRON_DISABLED=1 npm run dev
```

Port handling during dev
- If port 3000 is already taken (for example by a stray Next dev process), the dev server will attempt to terminate the listener automatically before starting, keeping the app on http://localhost:3000.
- macOS/Linux: uses `lsof` + signals.
- Windows: uses `netstat | findstr` to detect PIDs and `taskkill /PID /T /F` to terminate.
- If these tools are unavailable in your shell, stop the conflicting process manually.

opencron.json format
- Location: project root
- Shape:

```json
{
	"crons": [
		{ "url": "https://example.com/api/task", "schedule": "*/5 * * * *" }
	]
}
```

- Fields:
	- `url`: absolute `http(s)://` URL (required)
	- `schedule`: 5-field cron (minute hour day-of-month month day-of-week), validated; OR semantics for DOM vs DOW; UTC-based matching.

Local usage
- Add a cron: use the “Add Cron” form on the homepage
- Edit/Delete a cron: use the Edit/Delete controls on each entry
- Grouping and sorting: toggle “Group by domain” and “Sort A→Z”
- Reorder mode: toggle “Reorder mode” to show Up/Down buttons and persist order in `opencron.json`
- Favicons: grouped headers show site icons using DuckDuckGo’s icon service
- Manual evaluation: the scheduler runs automatically every minute in dev; watch the terminal logs

Vercel
- This repo no longer includes a Vercel Cron route or vercel.json. If you want to re-enable Vercel support, you can restore a simple API route that evaluates and triggers jobs and configure Vercel Cron to invoke it.

Deploy on Render/Railway (single service)
- This repo includes a custom Express server at [server.js](server.js) that:
	- Boots Next.js and serves the app
	- Starts a minute-aligned in-process scheduler that reads `opencron.json` directly and fires GETs for due jobs (UTC), no cron provider needed
- This lets you deploy on Render/Railway with a single Web Service (no separate worker/KV) and keep everything in one project.

Render setup
- Build Command:
```bash
npm install
npm run build
```
- Start Command:
```bash
npm start
```
- Environment:
	- `PORT` is provided by Render
	- Optional: set `CRON_DISABLED=1` to disable the in-process scheduler (useful for debugging or if you switch to an external ping)

How it works on Render/Railway
- The server starts, prints the base URL, and aligns a timer to the next minute.
- On each minute, it reads `opencron.json`, evaluates each 5-field cron in UTC, and sends GET requests for entries matching the current minute.
- A per-URL de-dup guard prevents multiple runs within the same minute key.
- Updates to `opencron.json` are picked up after redeploys (no DB/KV required).

Important notes and limits
- Interval fidelity: Jobs are evaluated once per minute (UTC). If you need sub-minute precision, you’ll need a different cadence or approach.
- UTC matching: All matching uses UTC for predictability and DST safety.
- Idempotency: If your targets aren’t idempotent, consider handling deduplication server-side based on headers (`User-Agent`, `X-OpenCron`) or timestamps.
- Timeouts: Each request has a ~20–25s timeout to avoid long stalls.
- GET only: This runner issues GET requests. If you need other methods, extend the code accordingly.

Persistence and “last run”
- By default, last-run data is in-memory only and resets on restart/deploy.
- Optional on-disk state: set `OPENCRON_STATE_PATH` (e.g., `/var/data/opencron-state.json`). The server will persist a minimal state file with the last minute key per URL after each tick.
- Render/Railway: To persist across deploys, attach a Disk and point `OPENCRON_STATE_PATH` into the mounted directory. Without a disk, the filesystem is ephemeral and state is not guaranteed to survive restarts or instance moves.
- Treat `opencron.json` as configuration — do not write last-run info into it in production.

Commands
```bash
# Dev server
npm run dev

# Production build
npm run build

# Start production server locally
npm run start
```

Project layout
- Cron config and logic: [opencron.json](opencron.json), [lib/opencron.ts](lib/opencron.ts)
- CRUD actions: [app/actions/opencron.ts](app/actions/opencron.ts)
- Custom server + scheduler: [server.js](server.js)
- UI: [app/page.tsx](app/page.tsx), [components/*](components)

Logs, GitHub Actions sync, and setup
-----------------------------------

This project writes runtime logs into a `logs/` folder at the repository root (one JSON file per host, e.g. `logs/example.com.json`). The included GitHub Action fetches the app's export endpoint and persists these per-host JSON files into the `main` branch on a regular schedule.

Workflow behavior and required secrets
- Schedule: runs at 00:00, 06:00, 12:00, 18:00 UTC (see `.github/workflows/sync-logs.yml`).
- Secrets:
	- `APP_URL` — base URL for your running app (defaults to `${APP_URL}/api/cron/export-logs`).
	- OR `LOGS_ENDPOINT` — full export URL to use instead.

Set secrets via GitHub UI or the `gh` CLI, for example:

```bash
gh secret set APP_URL --body "https://your-app.example.com"
```

Notes and recommendations
- The export endpoint must be reachable from GitHub Actions. If your app is private, either expose a reachable endpoint or use a host-accessible endpoint.
- Do not log sensitive information (authorization headers, secrets, PII). Consider redaction or truncation before storing response bodies. The server already limits stored snippets by default.
- The action pushes into `main` by default. If you prefer a dedicated branch instead, edit `.github/workflows/sync-logs.yml` and change the `git push` target.

Testing locally

```bash
# start the dev server
npm run dev

# fetch the combined export
curl -fsS http://localhost:3000/api/cron/export-logs | jq .

# inspect per-host files written by the workflow (after the action runs in CI)
ls -la logs
```

Contributing
- Issues and PRs welcome. Please keep the schema simple and avoid introducing server-side state so deployments remain stateless.

