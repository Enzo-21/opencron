"use client"

import { useEffect, useState } from "react"
import { useProductionCommit } from "@/app/hooks/useProductionCommit"

export default function ProductionFooter() {
  const { commit } = useProductionCommit()
  const [lastPush, setLastPush] = useState<string | null>(null)
  const [nextPush, setNextPush] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const isProd = (process.env.NODE_ENV || 'development') === 'production' || (process.env.NEXT_PUBLIC_APP_ENV || '') === 'production';

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/production/logs/status')
      if (!res.ok) return
      const data = await res.json()
      setLastPush(data.lastPush ?? null)
      setNextPush(data.nextPush ?? null)
    } catch (err) {
      // ignore
    }
  }

  useEffect(() => {
    fetchStatus()
  }, [])

  const handlePush = async () => {
    setLoading(true)
    try {
      await commit('UI: manual push from UI')
      await fetchStatus()
    } finally {
      setLoading(false)
    }
  }

  const fmt = (iso?: string | null) => {
    if (!iso) return 'Never'
    try {
      const d = new Date(iso)
      return d.toLocaleString()
    } catch {
      return iso
    }
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="text-xs text-muted-foreground">
        <div>Last logs push: <span className="font-medium">{fmt(lastPush)}</span></div>
        <div>Next scheduled push: <span className="font-medium">{fmt(nextPush)}</span></div>
      </div>
      <div>
        {!isProd ? (
          <button
            type="button"
            onClick={handlePush}
            disabled={loading}
            className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            {loading ? 'Pushing...' : 'Push to main'}
          </button>
        ) : (
          <div className="text-xs text-muted-foreground">Manual pushes disabled in production; changes are pushed on schedule.</div>
        )}
      </div>
    </div>
  )
}
