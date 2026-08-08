import { Hono } from 'hono'
import type { AppBindings } from '../../container'
import { createContainer } from '../../container'
import { parseOrThrow } from '../../lib/validate'
import { requireUser } from '../../middleware/requireUser'
import { loginSchema } from '../schemas/login'
import { passwordResetRequestSchema, passwordResetSchema } from '../schemas/passwordReset'
import { verifyEmailChangeSchema } from '../schemas/emailChange'
import {
  signupResendSchema,
  signupSchema,
  signupVerifySchema,
} from '../schemas/signup'

export const authApi = new Hono<AppBindings>()

authApi.post('/signup', async (c) => {
  const body = parseOrThrow(signupSchema, await c.req.json())
  const { signup } = createContainer(c)
  return c.json(await signup.execute(body), 201)
})

authApi.post('/signup/verify', async (c) => {
  const body = parseOrThrow(signupVerifySchema, await c.req.json())
  const { verifySignup } = createContainer(c)
  return c.json(
    await verifySignup.execute(
      {
        token: body.token,
        userAgent: c.req.header('user-agent') ?? '',
        ipAddress: c.req.header('cf-connecting-ip') ?? '',
      },
      c,
    ),
  )
})

authApi.post('/signup/resend', async (c) => {
  const body = parseOrThrow(signupResendSchema, await c.req.json())
  const { resendSignup } = createContainer(c)
  return c.json(await resendSignup.execute(body))
})

authApi.post('/login', async (c) => {
  const body = parseOrThrow(loginSchema, await c.req.json())
  const { login } = createContainer(c)
  return c.json(
    await login.execute(
      {
        ...body,
        userAgent: c.req.header('user-agent') ?? '',
        ipAddress: c.req.header('cf-connecting-ip') ?? '',
      },
      c,
    ),
  )
})

authApi.post('/logout', requireUser, async (c) => {
  const { sessionService } = createContainer(c)
  await sessionService.logoutUser(c)
  return c.json({ ok: true })
})

authApi.get('/google', async (c) => {
  const email = c.req.query('email')
  const name = c.req.query('name') ?? 'Google User'
  if (!email) {
    return c.json({ error: { code: 'validation_error', message: 'email required' } }, 400)
  }
  // ブラウザ向けは同意画面へ。API/自動化は ?direct=1 で callback URL を即生成
  if (c.req.query('direct') === '1') {
    const { googleLogin, mailer } = createContainer(c)
    return c.redirect(googleLogin.startUrl(mailer.getBaseUrl(), email, name))
  }
  const q = new URLSearchParams({ email, name })
  return c.redirect(`/auth/google/consent?${q.toString()}`)
})

authApi.get('/google/callback', async (c) => {
  const code = c.req.query('code')
  if (!code) {
    return c.json({ error: { code: 'validation_error', message: 'code required' } }, 400)
  }
  const { googleLogin } = createContainer(c)
  await googleLogin.callback(
    {
      code,
      userAgent: c.req.header('user-agent') ?? '',
      ipAddress: c.req.header('cf-connecting-ip') ?? '',
    },
    c,
  )
  return c.redirect('/mypage')
})

authApi.post('/password/reset-request', async (c) => {
  const body = parseOrThrow(passwordResetRequestSchema, await c.req.json())
  const { requestPasswordReset } = createContainer(c)
  return c.json(await requestPasswordReset.execute(body))
})

authApi.post('/password/reset', async (c) => {
  const body = parseOrThrow(passwordResetSchema, await c.req.json())
  const { resetPassword } = createContainer(c)
  return c.json(await resetPassword.execute(body))
})

authApi.post('/email/verify', async (c) => {
  const body = parseOrThrow(verifyEmailChangeSchema, await c.req.json())
  const { verifyEmailChange } = createContainer(c)
  return c.json(await verifyEmailChange.execute(body))
})
