import { Hono } from 'hono'
import type { AppBindings } from './container'
import { createContainer } from './container'
import { createDb } from './db/client'
import { SessionKvGateway } from './gateways/SessionKvGateway'
import type { SessionRevocationMessage } from './gateways/SessionRevocationQueueGateway'
import { isDevLoginEnabled } from './lib/appEnv'
import { AppError, errorJson } from './lib/errors'
import { setFlash } from './lib/flash'
import { parseOrThrow } from './lib/validate'
import { requireAdminPage } from './middleware/requireAdminPage'
import { requireUserPage } from './middleware/requireUserPage'
import { signupResendSchema } from './presentation/schemas/signup'
import { adminApi } from './presentation/api/admin'
import { authApi } from './presentation/api/auth'
import { internalBatchApi } from './presentation/api/internalBatch'
import { meApi } from './presentation/api/me'
import { adminLoginPage } from './presentation/pages/adminLoginPage'
import {
  adminUserDetailPage,
  adminUsersListPage,
  mypagePage,
  signupPage,
  signupVerifyPage,
} from './presentation/pages/appPages'
import {
  emailChangePage,
  emailChangeVerifyPage,
  googleConsentPage,
  passwordResetPage,
  passwordResetRequestPage,
} from './presentation/pages/extraPages'
import { homePage } from './presentation/pages/homePage'
import { renderer } from './renderer'
import { SessionService } from './services/SessionService'
import { TokenIssuingService } from './services/TokenIssuingService'
import {
  PurgeExpiredTokensUseCase,
  PurgeWithdrawnPiiUseCase,
} from './usecases/batch/BatchUseCases'

const app = new Hono<AppBindings>()
app.use(renderer)

app.onError((err, c) => {
  const { status, body } = errorJson(err)
  return c.json(body, status as 400)
})

app.route('/auth', authApi)
app.route('/me', meApi)
app.route('/internal/batch', internalBatchApi)

// HTML 管理画面を adminApi より先に登録（同パス GET の JSON 横取りを防ぐ）
app.get('/admin/login', (c) => adminLoginPage(c))
app.get('/admin/users', requireAdminPage, (c) => adminUsersListPage(c))
app.on(['GET', 'POST'], '/admin/users/:id', requireAdminPage, (c) => adminUserDetailPage(c))
app.route('/admin', adminApi)

app.get('/', (c) => homePage(c))
app.post('/logout', async (c) => {
  const { sessionService } = createContainer(c)
  await sessionService.logoutUser(c)
  const form = await c.req.parseBody().catch(() => ({} as Record<string, string>))
  const redirectTo =
    typeof form.redirect === 'string' && form.redirect.startsWith('/') ? form.redirect : '/'
  return c.redirect(redirectTo)
})

/** POC 検証トップ: パスワード無しで userId セッション発行（production では 404） */
app.post('/dev/login-as', async (c) => {
  if (!isDevLoginEnabled(c.env.APP_ENV)) {
    return c.notFound()
  }
  const form = await c.req.parseBody()
  const userId = typeof form.userId === 'string' ? form.userId : ''
  const redirectTo =
    typeof form.redirect === 'string' && form.redirect.startsWith('/') ? form.redirect : '/'
  if (!userId) {
    setFlash(c, 'userId がありません')
    return c.redirect('/')
  }
  const { devLoginAs } = createContainer(c)
  try {
    await devLoginAs.execute(
      {
        userId,
        userAgent: c.req.header('user-agent') ?? '',
        ipAddress: c.req.header('cf-connecting-ip') ?? '',
      },
      c,
    )
    setFlash(c, '検証用ログイン完了')
    return c.redirect(redirectTo)
  } catch (e) {
    const msg =
      e instanceof AppError
        ? e.message
        : e instanceof Error
          ? e.message
          : 'ログインに失敗しました'
    setFlash(c, msg)
    return c.redirect('/')
  }
})

/** POC: パスワード無しで管理者セッション発行（production では 404） */
app.post('/dev/login-as-admin', async (c) => {
  if (!isDevLoginEnabled(c.env.APP_ENV)) {
    return c.notFound()
  }
  const form = await c.req.parseBody()
  const adminId = typeof form.adminId === 'string' ? form.adminId : ''
  const redirectTo =
    typeof form.redirect === 'string' && form.redirect.startsWith('/')
      ? form.redirect
      : '/admin/users'
  if (!adminId) {
    setFlash(c, 'adminId がありません')
    return c.redirect('/admin/login')
  }
  const { devLoginAsAdmin } = createContainer(c)
  try {
    await devLoginAsAdmin.execute(
      {
        adminId,
        userAgent: c.req.header('user-agent') ?? '',
        ipAddress: c.req.header('cf-connecting-ip') ?? '',
      },
      c,
    )
    setFlash(c, '管理者ログイン完了')
    return c.redirect(redirectTo)
  } catch (e) {
    const msg =
      e instanceof AppError
        ? e.message
        : e instanceof Error
          ? e.message
          : 'ログインに失敗しました'
    setFlash(c, msg)
    return c.redirect('/admin/login')
  }
})

app.post('/dev/logout-admin', async (c) => {
  const { sessionService } = createContainer(c)
  await sessionService.logoutAdmin(c)
  setFlash(c, '管理者ログアウトしました')
  return c.redirect('/admin/login')
})
app.on(['GET', 'POST'], '/signup', (c) => signupPage(c))
/** 検証トップ: 期限切れ signup の確認メール再送（PRG + flash） */
app.post('/signup/resend', async (c) => {
  const form = await c.req.parseBody()
  const redirectTo =
    typeof form.redirect === 'string' && form.redirect.startsWith('/') ? form.redirect : '/'
  try {
    const body = parseOrThrow(signupResendSchema, form)
    const { resendSignup } = createContainer(c)
    const result = await resendSignup.execute(body)
    setFlash(c, `確認メールを再送しました: ${result.actionUrl}`)
  } catch (e) {
    const msg =
      e instanceof AppError
        ? e.message
        : e instanceof Error
          ? e.message
          : '再送に失敗しました'
    setFlash(c, msg)
  }
  return c.redirect(redirectTo)
})
app.get('/auth/signup/verify', (c) => signupVerifyPage(c))
app.on(['GET', 'POST'], '/mypage', requireUserPage, (c) => mypagePage(c))
app.on(['GET', 'POST'], '/mypage/email-change', requireUserPage, (c) => emailChangePage(c))
app.get('/email-change/verify', (c) => emailChangeVerifyPage(c))
app.on(['GET', 'POST'], '/password/reset-request', (c) => passwordResetRequestPage(c))
app.on(['GET', 'POST'], '/password/reset', (c) => passwordResetPage(c))
app.on(['GET', 'POST'], '/auth/google/consent', (c) => googleConsentPage(c))

export default {
  fetch: app.fetch,
  async queue(batch: MessageBatch<SessionRevocationMessage>, env: CloudflareBindings) {
    const kv = new SessionKvGateway(env.SESSIONS_KV)
    const sessions = new SessionService(kv, new TokenIssuingService(), env.APP_ENV)
    for (const msg of batch.messages) {
      try {
        const n = await sessions.revokeAllUserSessions(msg.body.userId)
        console.log(
          JSON.stringify({
            type: 'session_revocation',
            userId: msg.body.userId,
            reason: msg.body.reason,
            deleted: n,
          }),
        )
        msg.ack()
      } catch (e) {
        console.error('session revocation failed', e)
        msg.retry()
      }
    }
  },
  async scheduled(_controller: ScheduledController, env: CloudflareBindings) {
    const db = createDb(env.DB)
    const pii = await new PurgeWithdrawnPiiUseCase(db).execute()
    const tokens = await new PurgeExpiredTokensUseCase(db).execute()
    console.log(JSON.stringify({ type: 'cron_batch', pii, tokens }))
  },
}
