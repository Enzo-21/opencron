import { NextRequest, NextResponse } from 'next/server'
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

// This route runs only in production and commits/pushes repository changes
// using a GitHub personal access token stored in environment variables.

export async function POST(req: NextRequest) {
  const env = process.env.NODE_ENV || 'development'
  if (env !== 'production') {
    return NextResponse.json({ error: 'Not in production' }, { status: 403 })
  }

  let payload: { commitMessage?: string } = {}
  try {
    payload = await req.json()
  } catch {
    payload = {}
  }

  // Environment configuration for pushing to GitHub
  const repoPath = process.env.OPENCRON_REPO_PATH || '/Users/enzo/Desktop/opencron'
  const token = process.env.GH_TOKEN
  const owner = process.env.GH_OWNER
  const repo = process.env.GH_REPO
  const branch = (process.env.GH_BRANCH || 'main').trim()

  if (!token || !owner || !repo) {
    return NextResponse.json({ error: 'Missing GitHub credentials in environment' }, { status: 500 })
  }

  const remote = `https://${token}:x-oauth-token@github.com/${owner}/${repo}.git`

  try {
    // Ensure logs directory exists inside the repo for audit trails
    const logsDir = path.join(repoPath, 'logs')
    try {
      fs.mkdirSync(logsDir, { recursive: true })
    } catch {
      // ignore if cannot create logs dir
    }

    // Audit log: record the attempt
    const auditPath = path.join(logsDir, 'prod_commit.log')
    try {
      fs.appendFileSync(auditPath, `${new Date().toISOString()} - prod commit requested (route).\n`)
    } catch {
      // ignore logging failures
    }

    // Check for actual changes before committing
    const status = execSync(`git -C ${repoPath} status --porcelain`).toString().trim()
    if (!status) {
      return NextResponse.json({ ok: true, changes: false })
    }

    // Update or add the origin remote to use the token-authenticated URL
    try {
      execSync(`git -C ${repoPath} remote get-url origin`, { stdio: 'ignore' })
      execSync(`git -C ${repoPath} remote set-url origin ${remote}`)
    } catch {
      execSync(`git -C ${repoPath} remote add origin ${remote}`)
    }

    // Stage all changes and commit
    execSync(`git -C ${repoPath} add -A`)
    const message = (payload.commitMessage ?? 'UI-driven production update').replace(/"/g, '\\"')
    execSync(`git -C ${repoPath} commit -m "${message}"`, { stdio: 'ignore' })

    // Push to the configured branch
    execSync(`git -C ${repoPath} push origin ${branch}`)

    return NextResponse.json({ ok: true, changes: true })
  } catch (e) {
    const err = (e as any).message || 'Push failed'
    return NextResponse.json({ error: err }, { status: 500 })
  }
}

export default function handler() {
  // This default export is not used by Next.js in App Router; keep for compatibility if needed.
  return null as any
}
