import type { Context } from 'hono'
import type { AppBindings } from '../../container'
import { createContainer } from '../../container'
import { consumeFlash, setFlash } from '../../lib/flash'
import { parseOrThrow } from '../../lib/validate'
import { passwordResetRequestSchema, passwordResetSchema } from '../schemas/passwordReset'
import { requestEmailChangeSchema } from '../schemas/emailChange'

export async function googleConsentPage(c: Context<AppBindings>) {
  const email = c.req.query('email')
  const name = c.req.query('name') ?? 'Google User'
  if (!email) {
    return c.render(
      <main class="space-y-3">
        <h1 class="text-xl font-semibold">Google モック</h1>
        <p class="text-sm">email クエリが必要です。</p>
        <a class="underline" href="/">
          トップへ
        </a>
      </main>,
      { flash: consumeFlash(c) },
    )
  }

  if (c.req.method === 'POST') {
    const { googleLogin, mailer } = createContainer(c)
    const url = googleLogin.startUrl(mailer.getBaseUrl(), email, name)
    return c.redirect(url)
  }

  return c.render(
    <main class="mx-auto max-w-md space-y-4">
      <h1 class="text-2xl font-semibold">Google アカウントで続行（モック）</h1>
      <p class="text-sm text-neutral-600">
        実 Google API は使いません。以下のダミープロフィールで同意したことにします。
      </p>
      <dl class="rounded border bg-white p-4 text-sm">
        <div>
          <dt class="font-medium">email（PII）</dt>
          <dd>{email}</dd>
        </div>
        <div class="mt-2">
          <dt class="font-medium">name（PII）</dt>
          <dd>{name}</dd>
        </div>
      </dl>
      <form method="post" class="flex gap-3">
        <button class="rounded bg-neutral-900 px-4 py-2 text-white" type="submit">
          同意して続行
        </button>
        <a class="rounded border px-4 py-2" href="/">
          キャンセル
        </a>
      </form>
    </main>,
    { flash: consumeFlash(c) },
  )
}

export async function passwordResetRequestPage(c: Context<AppBindings>) {
  if (c.req.method === 'POST') {
    const form = await c.req.parseBody()
    const redirectTo =
      typeof form.redirect === 'string' && form.redirect.startsWith('/')
        ? form.redirect
        : '/password/reset-request'
    try {
      const body = parseOrThrow(passwordResetRequestSchema, form)
      const { requestPasswordReset } = createContainer(c)
      const result = await requestPasswordReset.execute(body)
      const actionUrl = 'actionUrl' in result ? (result as { actionUrl?: string }).actionUrl : undefined
      setFlash(
        c,
        actionUrl
          ? `申請を受け付けました。URL: ${actionUrl}`
          : '申請を受け付けました（該当メールが無い場合も同じ応答です）',
      )
    } catch (e) {
      const msg = e instanceof Error ? e.message : '申請に失敗しました'
      setFlash(c, msg)
    }
    return c.redirect(redirectTo)
  }
  return c.render(
    <main class="mx-auto max-w-md space-y-4">
      <h1 class="text-2xl font-semibold">パスワードリセット申請</h1>
      <form method="post" class="space-y-3">
        <input class="w-full border px-3 py-2" name="email" type="email" required />
        <button class="rounded bg-neutral-900 px-4 py-2 text-white" type="submit">
          申請
        </button>
      </form>
      <a class="text-sm underline" href="/">
        トップへ
      </a>
    </main>,
    { flash: consumeFlash(c) },
  )
}

export async function passwordResetPage(c: Context<AppBindings>) {
  const tokenFromQuery = c.req.query('token') ?? ''
  if (c.req.method === 'POST') {
    const form = await c.req.parseBody()
    try {
      const body = parseOrThrow(passwordResetSchema, {
        token: String(form.token || tokenFromQuery),
        password: String(form.password),
      })
      const { resetPassword } = createContainer(c)
      await resetPassword.execute(body)
      setFlash(c, 'パスワードを更新しました。再ログインしてください。')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'パスワード更新に失敗しました'
      setFlash(c, msg)
    }
    return c.redirect('/')
  }
  return c.render(
    <main class="mx-auto max-w-md space-y-4">
      <h1 class="text-2xl font-semibold">新しいパスワード</h1>
      <form method="post" class="space-y-3">
        {tokenFromQuery ? (
          <input type="hidden" name="token" value={tokenFromQuery} />
        ) : (
          <input class="w-full border px-3 py-2" name="token" placeholder="token" required />
        )}
        {tokenFromQuery ? <p class="text-xs text-neutral-500">token はクエリから取得済み</p> : null}
        <input
          class="w-full border px-3 py-2"
          name="password"
          type="password"
          placeholder="new password"
          required
        />
        <button class="rounded bg-neutral-900 px-4 py-2 text-white" type="submit">
          更新
        </button>
      </form>
    </main>,
    { flash: consumeFlash(c) },
  )
}

export async function emailChangePage(c: Context<AppBindings>) {
  const userId = c.get('userId')!
  if (c.req.method === 'POST') {
    const body = parseOrThrow(requestEmailChangeSchema, await c.req.parseBody())
    const { requestEmailChange } = createContainer(c)
    const result = await requestEmailChange.execute({ userId, ...body })
    setFlash(c, `確認メールをログ出力しました: ${result.actionUrl}`)
    return c.redirect('/mypage/email-change')
  }
  return c.render(
    <main class="mx-auto max-w-md space-y-4">
      <h1 class="text-2xl font-semibold">メールアドレス変更</h1>
      <form method="post" class="space-y-3">
        <input
          class="w-full border px-3 py-2"
          name="newEmail"
          type="email"
          placeholder="new email"
          required
        />
        <button class="rounded bg-neutral-900 px-4 py-2 text-white" type="submit">
          申請
        </button>
      </form>
      <a class="text-sm underline" href="/mypage">
        マイページへ
      </a>
    </main>,
    { flash: consumeFlash(c) },
  )
}

export async function emailChangeVerifyPage(c: Context<AppBindings>) {
  const token = c.req.query('token')
  if (!token) {
    return c.render(<main>token がありません</main>, { flash: consumeFlash(c) })
  }
  try {
    const { verifyEmailChange } = createContainer(c)
    const result = await verifyEmailChange.execute({ token })
    setFlash(c, `メールを ${result.email} に更新しました`)
    return c.redirect('/mypage')
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'verify failed'
    return c.render(
      <main class="space-y-2">
        <p>検証失敗: {msg}</p>
        <a class="underline" href="/mypage">
          マイページ
        </a>
      </main>,
      { flash: consumeFlash(c) },
    )
  }
}
