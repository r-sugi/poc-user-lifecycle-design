import type { Context } from 'hono'
import { jsxRenderer } from 'hono/jsx-renderer'
import { Link, ViteClient } from 'vite-ssr-components/hono'
import type { AppBindings } from './container'
import { createContainer } from './container'
import { AdminSessionBanner, FlashBanner } from './presentation/components/statusBadge'

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

export const renderer = jsxRenderer(async ({ children, flash, title }, c) => {
  const adminName = await resolveAdminSessionLabel(c)
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
        {adminName ? <AdminSessionBanner name={adminName} /> : null}
        <div class="mx-auto max-w-6xl px-4 py-4">
          <FlashBanner message={flash} />
          {children}
        </div>
      </body>
    </html>
  )
})
