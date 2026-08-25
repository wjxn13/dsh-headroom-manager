/**
 * dsh-headroom-manager HTTP routes: the browser half's data plane.
 *
 * WHY CUSTOM ROUTES (same escape hatch as dsh-caveman / dsh-market):
 * The dsh API gateway only serves allowlisted settings namespaces to the
 * browser, and the official headroom-switch plugin deliberately does NOT
 * manage the proxy process (it only flips llm-deepseek.baseURL). This plugin
 * fills that gap with plain HTTP routes on the host webServer:
 *
 *   GET  /headroom-mgr/status  — probe /livez + read savings stats + PID
 *   POST /headroom-mgr/start   — spawn headroom.exe detached (survives dsh)
 *   POST /headroom-mgr/stop    — kill the process listening on :8787
 *
 * All writes check same-origin (Origin header must match Host) so a cross-site
 * page cannot start or kill processes through the user's browser (CSRF).
 */
import { spawn, exec } from 'node:child_process'
import { request as httpRequest } from 'node:http'
import type { ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'

const HEADROOM_EXE = 'D:\\python\\Scripts\\headroom.exe'
const HEADROOM_PORT = 8787
const LIVEZ_URL = `http://127.0.0.1:${HEADROOM_PORT}/livez`
/** Mirrors start-headroom.vbs env so behavior matches the desktop shortcut. */
const HEADROOM_ENV = {
  HEADROOM_DETECT_BACKEND: 'python',
  HEADROOM_TOOL_SEARCH: 'off',
}

interface SavingsLifetime {
  requests?: number
  tokens_saved?: number
  compression_savings_usd?: number
  cache_savings_usd?: number
  cache_read_tokens?: number
  total_input_tokens?: number
}

/** True when the request originates from the served web app (Origin === Host). */
function sameOrigin(request: { headers: { origin?: string, host?: string } }): boolean {
  const origin = request.headers.origin
  const host = request.headers.host
  if (origin === undefined || host === undefined) return false
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
  })
  response.end(JSON.stringify(body))
}

function fetchJson(url: string, timeoutMs = 3000): Promise<unknown | undefined> {
  return new Promise((resolve) => {
    const req = httpRequest(url, { method: 'GET', timeout: timeoutMs }, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
        } catch {
          resolve(undefined)
        }
      })
    })
    req.on('timeout', () => {
      req.destroy()
      resolve(undefined)
    })
    req.on('error', () => resolve(undefined))
    req.end()
  })
}

/** Find the PID listening on HEADROOM_PORT via netstat; undefined when none. */
function findPortPid(): Promise<string | undefined> {
  return new Promise((resolve) => {
    exec(`netstat -ano`, { encoding: 'utf8' }, (err, stdout) => {
      if (err) return resolve(undefined)
      for (const line of stdout.split('\n')) {
        if (line.includes(`:${HEADROOM_PORT}`) && line.includes('LISTENING')) {
          const parts = line.trim().split(/\s+/)
          const pid = parts[parts.length - 1]
          if (/^\d+$/.test(pid)) return resolve(pid)
        }
      }
      resolve(undefined)
    })
  })
}

function killPid(pid: string): Promise<boolean> {
  return new Promise((resolve) => {
    // taskkill needs single-slash flags on win32; exec uses cmd so quoting is plain.
    exec(`taskkill /F /PID ${pid}`, (err) => resolve(!err))
  })
}

/**
 * Mount the three management routes.
 * @returns disposer removing all routes.
 */
export function mountManagerRoutes(ctx: Context): () => void {
  // Caller MUST acquire webServer via ctx.inject(['webServer'], ...) — a sync
  // ctx.get races plugin load order and silently skips mounting.
  const webServer = ctx.get('webServer')
  if (webServer === undefined) {
    console.error('[dsh-headroom-manager] webServer absent — routes not mounted')
    return () => {}
  }

  async function status(): Promise<Record<string, unknown>> {
    const livez = await fetchJson(LIVEZ_URL) as { version?: string } | undefined
    const running = livez !== undefined
    let pid: string | undefined
    if (running) pid = await findPortPid()
    let savings: SavingsLifetime | undefined
    if (running) {
      savings = await fetchJson(`http://127.0.0.1:${HEADROOM_PORT}/stats-history`) as
        | { lifetime?: SavingsLifetime }
        | undefined
        ?? undefined
      savings = (savings as { lifetime?: SavingsLifetime })?.lifetime
    }
    return {
      running,
      version: livez?.version,
      pid,
      exe: HEADROOM_EXE,
      port: HEADROOM_PORT,
      savings: savings ?? null,
    }
  }

  const disposers = [
    webServer.register({
      kind: 'exact',
      path: '/headroom-mgr/status',
      handler: (_request, response) => {
        void status().then((s) => sendJson(response, 200, s))
      },
    }),
    webServer.register({
      kind: 'exact',
      path: '/headroom-mgr/start',
      handler: async (request, response) => {
        if (request.method !== 'POST') {
          sendJson(response, 405, { error: 'method not allowed; use POST' })
          return
        }
        if (!sameOrigin(request)) {
          sendJson(response, 403, { error: 'untrusted origin' })
          return
        }
        const already = await fetchJson(LIVEZ_URL)
        if (already !== undefined) {
          sendJson(response, 200, { ok: true, alreadyRunning: true })
          return
        }
        try {
          // Launch via `cmd /c start` so the proxy escapes dsh's process tree:
          // a plain detached spawn still dies when the dsh host crashes or is
          // killed (Windows job object semantics), which would take the proxy
          // down with it. `start` creates a fully independent process.
          const vbsPath = `${process.env.USERPROFILE}\\.headroom\\start-headroom.vbs`
          const child = spawn('cmd.exe', ['/c', 'start', '""', 'wscript.exe', `"${vbsPath}"`], {
            detached: true,
            stdio: 'ignore',
            windowsVerbatimArguments: true,
          })
          child.unref()
          // give the proxy a moment to bind before reporting (vbs → wscript →
          // headroom cold start takes ~10s; poll up to 20s)
          const deadline = Date.now() + 20000
          let live: unknown = undefined
          while (Date.now() < deadline) {
            await new Promise((r) => setTimeout(r, 1500))
            live = await fetchJson(LIVEZ_URL)
            if (live !== undefined) break
          }
          sendJson(response, 200, {
            ok: true,
            healthyAfterStart: live !== undefined,
          })
        } catch (err) {
          sendJson(response, 500, { error: String(err) })
        }
      },
    }),
    webServer.register({
      kind: 'exact',
      path: '/headroom-mgr/stop',
      handler: async (request, response) => {
        if (request.method !== 'POST') {
          sendJson(response, 405, { error: 'method not allowed; use POST' })
          return
        }
        if (!sameOrigin(request)) {
          sendJson(response, 403, { error: 'untrusted origin' })
          return
        }
        const pid = await findPortPid()
        if (pid === undefined) {
          sendJson(response, 200, { ok: true, wasRunning: false })
          return
        }
        const killed = await killPid(pid)
        sendJson(response, killed ? 200 : 500, {
          ok: killed,
          stoppedPid: killed ? pid : undefined,
        })
      },
    }),
  ]

  return () => {
    for (const dispose of disposers) dispose()
  }
}
