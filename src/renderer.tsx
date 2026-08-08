import type { Context } from 'hono'
import { jsxRenderer } from 'hono/jsx-renderer'
import { Link, ViteClient } from 'vite-ssr-components/hono'
import type { AppBindings } from './container'
import { createContainer } from './container'
import { AdminSessionBanner, FlashBanner, UserSessionBanner } from './presentation/components/statusBadge'

declare module 'hono' {
  interface ContextRenderer {
    (
      content: string | Promise<string>,
      props?: { flash?: string | null; title?: string },
    ): Response | Promise<Response>
  }
}

async function resolveAdminSessionLabel(c: Context): Promise<string | null> {
  const { sessionService, adminRepo } = createContainer(c as Context<AppBindings>)
  const session = await sessionService.resolveFromAdminCookie(c)
  if (!session) return null
  const admin = await adminRepo.findById(session.adminId)
  return admin?.email ?? session.adminId
}

async function resolveUserSessionLabel(c: Context): Promise<string | null> {
  const { sessionService, profileRepo } = createContainer(c as Context<AppBindings>)
  const session = await sessionService.resolveFromUserCookie(c)
  if (!session) return null
  const profile = await profileRepo.findByUserId(session.userId)
  return profile?.email ?? session.userId
}

export const renderer = jsxRenderer(async ({ children, flash, title }, c) => {
  const [adminName, userName] = await Promise.all([
    resolveAdminSessionLabel(c),
    resolveUserSessionLabel(c),
  ])
  return (
    <html lang="ja">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title ?? 'User Lifecycle POC'}</title>
        <ViteClient />
        <Link href="/src/style.css" rel="stylesheet" />
      </head>
      <body class="min-h-screen bg-neutral-50 text-neutral-900 antialiased">
        {adminName || userName ? (
          <div class="sticky top-0 z-50">
            {adminName ? <AdminSessionBanner name={adminName} /> : null}
            {userName ? <UserSessionBanner name={userName} /> : null}
          </div>
        ) : null}
        <div class="mx-auto max-w-6xl px-4 py-4">
          <FlashBanner message={flash} />
          {children}
        </div>
      </body>
    </html>
  )
})
