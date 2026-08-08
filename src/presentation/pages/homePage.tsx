import type { AppBindings } from '../../container'
import { createContainer } from '../../container'
import { formatJst } from '../../lib/datetime'
import { consumeFlash } from '../../lib/flash'
import type { HomeConfirmedRow, HomeSignupRow } from '../../usecases/admin/ListVerificationHomeUseCase'
import type { Context } from 'hono'
import { StateChip } from '../components/statusBadge'

export async function homePage(c: Context<AppBindings>) {
  const { listVerificationHome, sessionService } = createContainer(c)
  const { confirmed, signups } = await listVerificationHome.execute()
  const session = await sessionService.resolveFromUserCookie(c)
  const currentUserId = session?.userId ?? null
  const flash = consumeFlash(c)
  return c.render(
    <main class="mx-auto max-w-6xl space-y-8">
      <header class="space-y-2">
        <h1 class="text-3xl font-semibold tracking-tight">User Lifecycle POC</h1>
      </header>

      <nav class="flex flex-wrap gap-3 text-sm">
        <a class="underline" href="/signup">
          サインアップ
        </a>
        <a class="underline" href="/admin/login">
          管理者ログイン
        </a>
      </nav>

      <section class="space-y-3">
        <div class="flex items-baseline justify-between gap-3">
          <h2 class="text-xl font-medium">確定ユーザー</h2>
          <span class="text-xs text-neutral-500">{confirmed.length} 件</span>
        </div>
        <ConfirmedTable rows={confirmed} currentUserId={currentUserId} />
      </section>

      <section class="space-y-3">
        <div class="flex items-baseline justify-between gap-3">
          <h2 class="text-xl font-medium">メール確認待ち（users未作成）</h2>
          <span class="text-xs text-neutral-500">{signups.length} 件</span>
        </div>
        <SignupTable rows={signups} />
      </section>
    </main>,
    { flash },
  )
}

const thClass =
  'whitespace-nowrap px-4 py-2.5 text-left text-xs font-medium tracking-wide text-neutral-500'
const tdClass = 'px-4 py-3 align-middle text-sm text-neutral-800'

function ConfirmedTable(props: { rows: HomeConfirmedRow[]; currentUserId: string | null }) {
  if (props.rows.length === 0) {
    return <EmptyTable message="確定ユーザーはありません" />
  }
  return (
    <div class="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
      <div class="overflow-x-auto">
        <table class="min-w-full text-left">
          <thead class="border-b border-neutral-200 bg-neutral-50">
            <tr>
              <th class={thClass}>email（PII）</th>
              <th class={thClass}>現在の状態</th>
              <th class={thClass}>アクション</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-neutral-100">
            {props.rows.map((r) => {
              const isCurrent = props.currentUserId === r.userId
              return (
                <tr
                  class={`transition-colors ${isCurrent ? 'bg-sky-50/80' : 'hover:bg-neutral-50'}`}
                  key={r.userId}
                >
                  <td class={tdClass}>
                    <div class="flex flex-col gap-0.5">
                      <span class="font-medium text-neutral-900">{r.email}</span>
                      <span class="text-xs text-neutral-500">
                        {r.displayName}
                        {isCurrent ? (
                          <span class="ml-2 rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-sky-800">
                            ログイン中
                          </span>
                        ) : null}
                      </span>
                    </div>
                  </td>
                  <td class={tdClass}>
                    <StateChip label={r.currentState} />
                  </td>
                  <td class={tdClass}>
                    {isCurrent ? (
                      <div class="flex flex-wrap gap-2">
                        <a
                          class="inline-flex items-center rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                          href="/mypage"
                        >
                          マイページ
                        </a>
                        <PwResetButton email={r.email} />
                        {r.pendingPasswordResetToken ? (
                          <PwUpdateButton token={r.pendingPasswordResetToken} />
                        ) : null}
                        <form method="post" action="/logout" class="inline">
                          <input type="hidden" name="redirect" value="/" />
                          <button
                            type="submit"
                            class="inline-flex items-center rounded-md bg-neutral-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-neutral-700"
                          >
                            ログアウト
                          </button>
                        </form>
                      </div>
                    ) : r.loginAction.kind === 'dev-login' ? (
                      <div class="flex flex-wrap gap-2">
                        <form method="post" action="/dev/login-as" class="inline">
                          <input type="hidden" name="userId" value={r.userId} />
                          <input type="hidden" name="redirect" value="/mypage" />
                          <button type="submit" class={actionBtnClass}>
                            ログイン
                          </button>
                        </form>
                        <PwResetButton email={r.email} />
                        {r.pendingPasswordResetToken ? (
                          <PwUpdateButton token={r.pendingPasswordResetToken} />
                        ) : null}
                      </div>
                    ) : (
                      <span
                        class="inline-flex items-center rounded-md bg-neutral-100 px-2.5 py-1 text-xs text-neutral-500"
                        title={r.loginAction.reason}
                      >
                        {r.loginAction.reason}
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SignupTable(props: { rows: HomeSignupRow[] }) {
  if (props.rows.length === 0) {
    return <EmptyTable message="メール確認待ちはありません" />
  }
  return (
    <div class="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
      <div class="overflow-x-auto">
        <table class="min-w-full text-left">
          <thead class="border-b border-neutral-200 bg-neutral-50">
            <tr>
              <th class={thClass}>email（PII）</th>
              <th class={thClass}>使用期限</th>
              <th class={thClass}>使用日時</th>
              <th class={thClass}>現在の状態</th>
              <th class={thClass}>アクション</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-neutral-100">
            {props.rows.map((r) => (
              <tr class="transition-colors hover:bg-neutral-50" key={r.id}>
                <td class={tdClass}>
                  <div class="flex flex-col gap-0.5">
                    <span class="font-medium text-neutral-900">{r.email}</span>
                    <span class="text-xs text-neutral-500">{r.displayName}</span>
                  </div>
                </td>
                <td class={`${tdClass} whitespace-nowrap font-mono text-xs text-neutral-600`}>
                  {formatJst(r.expiresAt)}
                </td>
                <td class={`${tdClass} whitespace-nowrap font-mono text-xs text-neutral-600`}>
                  {formatJst(r.consumedAt)}
                </td>
                <td class={tdClass}>
                  <StateChip label={r.currentState} />
                </td>
                <td class={tdClass}>
                  {r.action.kind === 'verify' ? (
                    <a
                      class="inline-flex items-center rounded-md bg-neutral-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-neutral-700"
                      href={r.action.href}
                    >
                      メール認証する
                    </a>
                  ) : r.action.kind === 'resend' ? (
                    <form method="post" action="/signup/resend" class="inline">
                      <input type="hidden" name="email" value={r.action.email} />
                      <input type="hidden" name="redirect" value="/" />
                      <button type="submit" class={actionBtnClass}>
                        再送
                      </button>
                    </form>
                  ) : (
                    <span
                      class="inline-flex items-center rounded-md bg-neutral-100 px-2.5 py-1 text-xs text-neutral-500"
                      title={r.action.reason}
                    >
                      {r.action.reason}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function EmptyTable(props: { message: string }) {
  return (
    <div class="rounded-lg border border-dashed border-neutral-300 bg-white px-4 py-10 text-center text-sm text-neutral-500">
      {props.message}
    </div>
  )
}

const actionBtnClass =
  'inline-flex items-center rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50'

function PwResetButton(props: { email: string }) {
  return (
    <form method="post" action="/password/reset-request" class="inline">
      <input type="hidden" name="email" value={props.email} />
      <input type="hidden" name="redirect" value="/" />
      <button type="submit" class={actionBtnClass}>
        PWリセット
      </button>
    </form>
  )
}

/** 検証トップ・ワンクリック PW更新用（シード既知パスワードと同一） */
const VERIFICATION_NEW_PASSWORD = 'Password123!'

function PwUpdateButton(props: { token: string }) {
  return (
    <form method="post" action="/password/reset" class="inline">
      <input type="hidden" name="token" value={props.token} />
      <input type="hidden" name="password" value={VERIFICATION_NEW_PASSWORD} />
      <button type="submit" class={actionBtnClass}>
        PW更新
      </button>
    </form>
  )
}
