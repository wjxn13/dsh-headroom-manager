/**
 * dsh-headroom-manager host half.
 *
 * The host half is deliberately minimal: no systemPrompt, no commands — this
 * plugin exists purely to give the browser a process-management panel for the
 * Headroom compression proxy (the official headroom-switch plugin only flips
 * the route, it never starts or stops the proxy).
 *
 * IMPORTANT: webServer must be acquired via ctx.inject, NOT ctx.get — plugin
 * apply() runs before the webServer service starts, so a synchronous get
 * returns undefined and the routes silently never mount (observed with
 * dsh-caveman v0.3.0; SPA fallback then answers /headroom-mgr/*).
 */
import type { Context } from '@deepseek-ai/cordis'
import { mountManagerRoutes } from './routes.ts'

export const name = 'dsh-headroom-manager'
export const inject: string[] = []

export function apply(ctx: Context): void {
  ctx.inject(['webServer'], (scoped: Context) => {
    scoped.effect(() => mountManagerRoutes(scoped), 'dsh-headroom-manager http routes')
  })
}
