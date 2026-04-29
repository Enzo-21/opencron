// Client-side helper to trigger a production commit/push on the server
export async function pushProductionCommit({ commitMessage }: { commitMessage?: string }): Promise<void> {
  // Only run in production environment
  if (process.env.NEXT_PUBLIC_APP_ENV !== 'production' && process.env.NODE_ENV !== 'production') {
    return
  }

  const res = await fetch('/api/production/commit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ commitMessage }),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({} as any))
    throw new Error(data?.error ?? 'Production commit failed')
  }
}
