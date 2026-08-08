import type { Context } from 'hono'
import type { AppBindings } from '../../container'
import { createContainer } from '../../container'
import { banReasonLabelJa, withdrawReasonLabelJa } from '../../domain/shared/ReasonCode'
import { formatJst } from '../../lib/datetime'
import { consumeFlash, setFlash } from '../../lib/flash'
import { parseOrThrow } from '../../lib/validate'
import { isAnonymizedProfile } from '../../usecases/batch/BatchUseCases'
import { EventTimeline, StatusBadge } from '../components/statusBadge'
import { signupSchema } from '../schemas/signup'

const thClass =
  'whitespace-nowrap px-4 py-2.5 text-left text-xs font-medium tracking-wide text-neutral-500'
const tdClass = 'px-4 py-3 align-middle text-sm text-neutral-800'
const inputClass =
  'rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-800'
const btnSecondary =
  'inline-flex items-center rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50'
const btnDanger =
  'inline-flex items-center rounded-md bg-red-700 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-red-800'
const panelClass = 'overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm'
const panelHeadClass = 'border-b border-neutral-200 bg-neutral-50 px-4 py-2.5'
const panelHeadTitleClass = 'text-xs font-medium tracking-wide text-neutral-500'

function randomSignupDefaults() {
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 10)
  return {
    email: `signup-${id}@example.com`,
    password: `Pass${id}!`,
    displayName: `User ${id.slice(0, 6)}`,
  }
}

export async function signupPage(c: Context<AppBindings>) {
  if (c.req.method === 'POST') {
    const body = parseOrThrow(signupSchema, await c.req.parseBody())
    const { signup } = createContainer(c)
    await signup.execute(body)
    setFlash(c, `${body.displayName}\n${body.email}\nメール認証してください`)
    return c.redirect('/')
  }
  const flash = consumeFlash(c)
  const defaults = randomSignupDefaults()
  return c.render(
    <main class="mx-auto max-w-md space-y-4 p-6">
      <h1 class="text-2xl font-semibold">サインアップ</h1>
      {flash ? <p class="text-sm text-green-800">{flash}</p> : null}
      <form method="post" class="space-y-3">
        <input
          class="w-full border px-3 py-2"
          name="email"
          type="email"
          value={defaults.email}
          placeholder="email"
          required
        />
        <input
          class="w-full border px-3 py-2"
          name="password"
          type="password"
          value={defaults.password}
          placeholder="password"
          required
        />
        <input
          class="w-full border px-3 py-2"
          name="displayName"
          value={defaults.displayName}
          placeholder="display name"
          required
        />
        <button class="rounded bg-neutral-900 px-4 py-2 text-white" type="submit">
          申込
        </button>
      </form>
      <a class="text-sm underline" href="/">
        トップへ
      </a>
    </main>,
  )
}

export async function mypagePage(c: Context<AppBindings>) {
  const userId = c.get('userId')!
  const { getMe, sessionService } = createContainer(c)
  if (c.req.method === 'POST') {
    const form = await c.req.parseBody()
    const action = String(form.action ?? '')
    const container = createContainer(c)
    if (action === 'withdraw') {
      await container.withdraw.execute({
        userId,
        reasonCode: String(form.reasonCode ?? 'no_longer_needed'),
      })
      setFlash(c, '退会しました')
    } else if (action === 'logout') {
      await sessionService.logoutUser(c)
      return c.redirect('/')
    }
    return c.redirect('/mypage')
  }

  let me: Awaited<ReturnType<typeof getMe.execute>>
  try {
    me = await getMe.execute(userId)
  } catch {
    setFlash(c, 'セッション無効またはステータスにより閲覧不可')
    const { sessionService: s } = createContainer(c)
    await s.logoutUser(c)
    return c.redirect('/')
  }
  const flash = consumeFlash(c)
  return c.render(
    <main class="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 class="text-2xl font-semibold tracking-tight">マイページ</h1>
      </header>

      <section class="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
        <div class="border-b border-neutral-200 bg-neutral-50 px-4 py-2.5">
          <h2 class="text-xs font-medium tracking-wide text-neutral-500">アカウント</h2>
        </div>
        <dl class="divide-y divide-neutral-100">
          <div class="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
            <dt class="w-28 shrink-0 text-xs font-medium text-neutral-500">メール（PII）</dt>
            <dd class="text-sm font-medium text-neutral-900">{me.profile?.email}</dd>
          </div>
          <div class="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
            <dt class="w-28 shrink-0 text-xs font-medium text-neutral-500">ステータス</dt>
            <dd>
              <StatusBadge status={me.status} />
            </dd>
          </div>
          <div class="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
            <dt class="w-28 shrink-0 text-xs font-medium text-neutral-500">認証方法</dt>
            <dd class="text-sm text-neutral-800">
              {me.identities.length > 0
                ? me.identities.map((i) => i.provider).join(', ')
                : '—'}
            </dd>
          </div>
        </dl>
      </section>

      <section class="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
        <div class="border-b border-neutral-200 bg-neutral-50 px-4 py-2.5">
          <h2 class="text-xs font-medium tracking-wide text-neutral-500">退会</h2>
        </div>
        <div class="p-4">
          <form method="post" id="withdraw-form" class="flex flex-col items-start gap-2">
            <input type="hidden" name="action" value="withdraw" />
            <div class="flex items-center gap-2">
              <label
                for="withdraw-reason"
                class="w-28 shrink-0 text-xs font-medium text-neutral-500"
              >
                退会理由
              </label>
              <select
                id="withdraw-reason"
                name="reasonCode"
                class="rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm text-neutral-800"
              >
                <option value="no_longer_needed">{withdrawReasonLabelJa('no_longer_needed')}</option>
                <option value="privacy">{withdrawReasonLabelJa('privacy')}</option>
                <option value="other">{withdrawReasonLabelJa('other')}</option>
              </select>
            </div>
            <button
              class="inline-flex items-center rounded-md bg-red-700 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-red-800"
              type="button"
              onclick="document.getElementById('withdraw-confirm').showModal()"
            >
              退会
            </button>
          </form>
          <dialog
            id="withdraw-confirm"
            class="m-auto max-w-sm rounded-lg border border-neutral-200 bg-white p-4 shadow-lg backdrop:bg-black/40"
          >
            <p class="text-sm text-neutral-800">
              退会するとアカウントが利用できなくなります。よろしいですか？
            </p>
            <div class="mt-4 flex justify-end gap-2">
              <form method="dialog">
                <button
                  type="submit"
                  class="inline-flex items-center justify-center rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-800 hover:bg-neutral-50"
                >
                  キャンセル
                </button>
              </form>
              <button
                type="submit"
                form="withdraw-form"
                class="inline-flex items-center justify-center rounded-md bg-red-700 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-red-800"
              >
                退会する
              </button>
            </div>
          </dialog>
        </div>
      </section>

      <section class="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
        <div class="border-b border-neutral-200 bg-neutral-50 px-4 py-2.5">
          <h2 class="text-xs font-medium tracking-wide text-neutral-500">セッション</h2>
        </div>
        <div class="p-4">
          <form method="post">
            <input type="hidden" name="action" value="logout" />
            <button
              class="inline-flex items-center rounded-md bg-neutral-900 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-neutral-700"
              type="submit"
            >
              ログアウト
            </button>
          </form>
        </div>
      </section>

      <a class="inline-block text-sm underline" href="/">
        トップへ
      </a>
    </main>,
    { flash },
  )
}

export async function adminUsersListPage(c: Context<AppBindings>) {
  const email = c.req.query('email')
  const { searchUsers } = createContainer(c)
  const users = await searchUsers.execute(email)
  return c.render(
    <main class="space-y-8">
      <header class="space-y-2">
        <h1 class="text-3xl font-semibold tracking-tight">ユーザー一覧</h1>
        <nav class="flex flex-wrap gap-3 text-sm">
          <a class="underline" href="/admin/login">
            管理者一覧へ
          </a>
        </nav>
      </header>

      <section class="space-y-3">
        <div class="flex flex-wrap items-end justify-between gap-3">
          <form method="get" class="flex flex-wrap items-center gap-2">
            <input
              class={inputClass}
              name="email"
              placeholder="email 検索"
              value={email ?? ''}
            />
            <button class={btnSecondary} type="submit">
              検索
            </button>
          </form>
          <span class="text-xs text-neutral-500">{users.length} 件</span>
        </div>

        {users.length === 0 ? (
          <div class="rounded-lg border border-dashed border-neutral-300 bg-white px-4 py-10 text-center text-sm text-neutral-500">
            ユーザーが見つかりません
          </div>
        ) : (
          <div class={panelClass}>
            <div class="overflow-x-auto">
              <table class="min-w-full text-left">
                <thead class="border-b border-neutral-200 bg-neutral-50">
                  <tr>
                    <th class={thClass}>email（PII）</th>
                    <th class={thClass}>作成日時</th>
                    <th class={thClass}>更新日時</th>
                    <th class={thClass}>アクション</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-neutral-100">
                  {users.map((u) => (
                    <tr class="transition-colors hover:bg-neutral-50" key={u.userId}>
                      <td class={tdClass}>
                        <div class="flex flex-col gap-0.5">
                          <span class="font-medium text-neutral-900">{u.email}</span>
                          <span class="text-xs text-neutral-500">{u.displayName}</span>
                        </div>
                      </td>
                      <td class={`${tdClass} whitespace-nowrap font-mono text-xs text-neutral-600`}>
                        {formatJst(u.createdAt)}
                      </td>
                      <td class={`${tdClass} whitespace-nowrap font-mono text-xs text-neutral-600`}>
                        {formatJst(u.updatedAt)}
                      </td>
                      <td class={tdClass}>
                        <a class={btnSecondary} href={`/admin/users/${u.userId}`}>
                          詳細
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </main>,
  )
}

export async function adminUserDetailPage(c: Context<AppBindings>) {
  const id = c.req.param('id')!
  const container = createContainer(c)
  if (c.req.method === 'POST') {
    const form = await c.req.parseBody()
    const action = String(form.action ?? '')
    if (action === 'ban') {
      await container.banUser.execute({
        userId: id,
        adminUserId: c.get('adminId')!,
        reasonCode: String(form.reasonCode ?? 'abuse'),
        reasonText: String(form.reasonText ?? ''),
      })
      setFlash(c, 'BAN しました')
    } else if (action === 'unban') {
      await container.unbanUser.execute({
        userId: id,
        adminUserId: c.get('adminId')!,
      })
      setFlash(c, 'BAN 解除しました')
    } else if (action === 'cancelWithdraw') {
      await container.cancelWithdraw.execute({ userId: id })
      setFlash(c, '退会を取り消しました')
    } else if (action === 'purgePii') {
      await container.forcePurgeUserPii.execute({ userId: id })
      setFlash(c, 'PII を削除しました')
    } else if (action === 'anonymizePii') {
      await container.forceAnonymizeUserPii.execute({ userId: id })
      setFlash(c, 'PII を匿名化しました')
    }
    return c.redirect(`/admin/users/${id}`)
  }
  const detail = await container.getUserDetail.execute(id)
  const flash = consumeFlash(c)
  const canHandlePii =
    (detail.user.status === 'banned' || detail.user.status === 'withdrawn') && !!detail.profile
  const profileAnonymized = detail.profile ? isAnonymizedProfile(detail.profile) : false
  const showAnonymizePii = canHandlePii && !profileAnonymized
  const showPurgePii = canHandlePii
  return c.render(
    <main class="space-y-8">
      <header class="space-y-2">
        <h1 class="text-3xl font-semibold tracking-tight">ユーザー詳細</h1>
        <nav class="flex flex-wrap gap-3 text-sm">
          <a class="underline" href="/admin/login">
            管理者一覧へ
          </a>
          <a class="underline" href="/admin/users">
            ユーザー管理へ
          </a>
        </nav>
      </header>

      <section class={panelClass}>
        <div class={panelHeadClass}>
          <h2 class={panelHeadTitleClass}>アカウント</h2>
        </div>
        <dl class="divide-y divide-neutral-100">
          <div class="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
            <dt class="w-28 shrink-0 text-xs font-medium text-neutral-500">メール（PII）</dt>
            <dd class="text-sm font-medium text-neutral-900">{detail.profile?.email ?? '—'}</dd>
          </div>
          <div class="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
            <dt class="w-28 shrink-0 text-xs font-medium text-neutral-500">表示名（PII）</dt>
            <dd class="text-sm text-neutral-800">{detail.profile?.displayName ?? '—'}</dd>
          </div>
          <div class="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
            <dt class="w-28 shrink-0 text-xs font-medium text-neutral-500">ステータス</dt>
            <dd>
              <StatusBadge status={detail.user.status} />
            </dd>
          </div>
          <div class="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
            <dt class="w-28 shrink-0 text-xs font-medium text-neutral-500">user id</dt>
            <dd class="font-mono text-xs text-neutral-600">{detail.user.id}</dd>
          </div>
          <div class="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
            <dt class="w-28 shrink-0 text-xs font-medium text-neutral-500">検証日時</dt>
            <dd class="font-mono text-xs text-neutral-600">{formatJst(detail.user.verifiedAt)}</dd>
          </div>
        </dl>
      </section>

      <section class="space-y-3">
        <div class="flex items-baseline justify-between gap-3">
          <h2 class="text-xl font-medium">履歴</h2>
          <span class="text-xs text-neutral-500">{detail.events.length} 件</span>
        </div>
        <div class={panelClass}>
          <EventTimeline events={detail.events} />
        </div>
      </section>

      <section class="space-y-3">
        <div class="flex items-baseline justify-between gap-3">
          <h2 class="text-xl font-medium">認証方法</h2>
          <span class="text-xs text-neutral-500">{detail.identities.length} 件</span>
        </div>
        {detail.identities.length === 0 ? (
          <div class="rounded-lg border border-dashed border-neutral-300 bg-white px-4 py-10 text-center text-sm text-neutral-500">
            認証方法はありません
          </div>
        ) : (
          <div class={panelClass}>
            <div class="overflow-x-auto">
              <table class="min-w-full text-left">
                <thead class="border-b border-neutral-200 bg-neutral-50">
                  <tr>
                    <th class={thClass}>provider</th>
                    <th class={thClass}>provider uid</th>
                    <th class={thClass}>作成日時</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-neutral-100">
                  {detail.identities.map((identity) => (
                    <tr class="transition-colors hover:bg-neutral-50" key={identity.id}>
                      <td class={tdClass}>{identity.provider}</td>
                      <td class={`${tdClass} font-mono text-xs text-neutral-600`}>
                        {identity.providerUid}
                      </td>
                      <td class={`${tdClass} whitespace-nowrap font-mono text-xs text-neutral-600`}>
                        {formatJst(identity.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <section class="space-y-3">
        <div class="flex items-baseline justify-between gap-3">
          <h2 class="text-xl font-medium">セッション</h2>
          <span class="text-xs text-neutral-500">{detail.sessions.length} 件</span>
        </div>
        {detail.sessions.length === 0 ? (
          <div class="rounded-lg border border-dashed border-neutral-300 bg-white px-4 py-10 text-center text-sm text-neutral-500">
            セッションはありません
          </div>
        ) : (
          <div class={panelClass}>
            <div class="overflow-x-auto">
              <table class="min-w-full text-left">
                <thead class="border-b border-neutral-200 bg-neutral-50">
                  <tr>
                    <th class={thClass}>key</th>
                    <th class={thClass}>IP（PII）</th>
                    <th class={thClass}>User-Agent</th>
                    <th class={thClass}>作成日時</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-neutral-100">
                  {detail.sessions.map((session) => (
                    <tr class="transition-colors hover:bg-neutral-50" key={session.key}>
                      <td class={`${tdClass} max-w-[12rem] truncate font-mono text-xs text-neutral-600`}>
                        {session.key}
                      </td>
                      <td class={`${tdClass} font-mono text-xs text-neutral-600`}>
                        {String(session.ipAddress ?? '—')}
                      </td>
                      <td class={`${tdClass} max-w-xs truncate text-xs text-neutral-600`} title={String(session.userAgent ?? '')}>
                        {String(session.userAgent ?? '—')}
                      </td>
                      <td class={`${tdClass} whitespace-nowrap font-mono text-xs text-neutral-600`}>
                        {formatJst(typeof session.createdAt === 'string' ? session.createdAt : null)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <section class="space-y-3">
        <h2 class="text-xl font-medium">最新 BAN</h2>
        {detail.latestBan ? (
          <div class={panelClass}>
            <dl class="divide-y divide-neutral-100">
              <div class="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
                <dt class="w-28 shrink-0 text-xs font-medium text-neutral-500">理由</dt>
                <dd class="text-sm text-neutral-800">
                  {banReasonLabelJa(detail.latestBan.ban.reasonCode)}
                  {detail.latestBan.ban.reasonText ? ` · ${detail.latestBan.ban.reasonText}` : ''}
                </dd>
              </div>
              <div class="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
                <dt class="w-28 shrink-0 text-xs font-medium text-neutral-500">admin</dt>
                <dd class="font-mono text-xs text-neutral-600">{detail.latestBan.ban.adminUserId}</dd>
              </div>
              <div class="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
                <dt class="w-28 shrink-0 text-xs font-medium text-neutral-500">日時</dt>
                <dd class="font-mono text-xs text-neutral-600">
                  {formatJst(detail.latestBan.ban.createdAt)}
                </dd>
              </div>
            </dl>
          </div>
        ) : (
          <div class="rounded-lg border border-dashed border-neutral-300 bg-white px-4 py-10 text-center text-sm text-neutral-500">
            BAN 履歴はありません
          </div>
        )}
      </section>

      <section class={panelClass}>
        <div class={panelHeadClass}>
          <h2 class={panelHeadTitleClass}>操作</h2>
        </div>
        <div class="space-y-4 p-4">
          <div>
            <form method="post" id="admin-ban-form" class="flex flex-wrap items-end gap-2">
              <input type="hidden" name="action" value="ban" />
              <label class="space-y-1">
                <span class="block text-xs font-medium text-neutral-500">理由</span>
                <select name="reasonCode" class={inputClass}>
                  <option value="abuse">{banReasonLabelJa('abuse')}</option>
                  <option value="spam">{banReasonLabelJa('spam')}</option>
                  <option value="tos_violation">{banReasonLabelJa('tos_violation')}</option>
                </select>
              </label>
              <label class="space-y-1">
                <span class="block text-xs font-medium text-neutral-500">補足</span>
                <input class={inputClass} name="reasonText" placeholder="reason text" />
              </label>
              <button
                class={btnDanger}
                type="button"
                onclick="document.getElementById('admin-ban-confirm').showModal()"
              >
                BAN
              </button>
            </form>
            <dialog
              id="admin-ban-confirm"
              class="m-auto max-w-sm rounded-lg border border-neutral-200 bg-white p-4 shadow-lg backdrop:bg-black/40"
            >
              <p class="text-sm text-neutral-800">このユーザーを BAN します。よろしいですか？</p>
              <div class="mt-4 flex justify-end gap-2">
                <form method="dialog">
                  <button type="submit" class={btnSecondary}>
                    キャンセル
                  </button>
                </form>
                <button type="submit" form="admin-ban-form" class={btnDanger}>
                  BAN する
                </button>
              </div>
            </dialog>
          </div>
          <div>
            <div class="flex flex-wrap gap-2">
              <form method="post" id="admin-unban-form">
                <input type="hidden" name="action" value="unban" />
                <button
                  class={btnSecondary}
                  type="button"
                  onclick="document.getElementById('admin-unban-confirm').showModal()"
                >
                  BAN 解除
                </button>
              </form>
              {detail.user.status === 'withdrawn' ? (
                <form method="post">
                  <input type="hidden" name="action" value="cancelWithdraw" />
                  <button class={btnSecondary} type="submit">
                    退会取消
                  </button>
                </form>
              ) : null}
              {showAnonymizePii ? (
                <form method="post" id="admin-anonymize-pii-form">
                  <input type="hidden" name="action" value="anonymizePii" />
                  <button
                    class={btnSecondary}
                    type="button"
                    onclick="document.getElementById('admin-anonymize-pii-confirm').showModal()"
                  >
                    PII匿名化
                  </button>
                </form>
              ) : null}
              {showPurgePii ? (
                <form method="post" id="admin-purge-pii-form">
                  <input type="hidden" name="action" value="purgePii" />
                  <button
                    class={btnDanger}
                    type="button"
                    onclick="document.getElementById('admin-purge-pii-confirm').showModal()"
                  >
                    PII削除
                  </button>
                </form>
              ) : null}
            </div>
            <dialog
              id="admin-unban-confirm"
              class="m-auto max-w-sm rounded-lg border border-neutral-200 bg-white p-4 shadow-lg backdrop:bg-black/40"
            >
              <p class="text-sm text-neutral-800">このユーザーの BAN を解除します。よろしいですか？</p>
              <div class="mt-4 flex justify-end gap-2">
                <form method="dialog">
                  <button type="submit" class={btnSecondary}>
                    キャンセル
                  </button>
                </form>
                <button type="submit" form="admin-unban-form" class={btnSecondary}>
                  解除する
                </button>
              </div>
            </dialog>
            <dialog
              id="admin-anonymize-pii-confirm"
              class="m-auto max-w-sm rounded-lg border border-neutral-200 bg-white p-4 shadow-lg backdrop:bg-black/40"
            >
              <p class="text-sm text-neutral-800">
                メール・表示名をダミー値に置き換え、認証手段を削除します。プロフィール行は残ります。よろしいですか？
              </p>
              <div class="mt-4 flex justify-end gap-2">
                <form method="dialog">
                  <button type="submit" class={btnSecondary}>
                    キャンセル
                  </button>
                </form>
                <button type="submit" form="admin-anonymize-pii-form" class={btnSecondary}>
                  PII匿名化する
                </button>
              </div>
            </dialog>
            <dialog
              id="admin-purge-pii-confirm"
              class="m-auto max-w-sm rounded-lg border border-neutral-200 bg-white p-4 shadow-lg backdrop:bg-black/40"
            >
              <p class="text-sm text-neutral-800">
                メール・表示名・認証手段を物理削除します。この操作は取り消せません。よろしいですか？
              </p>
              <div class="mt-4 flex justify-end gap-2">
                <form method="dialog">
                  <button type="submit" class={btnSecondary}>
                    キャンセル
                  </button>
                </form>
                <button type="submit" form="admin-purge-pii-form" class={btnDanger}>
                  PII削除する
                </button>
              </div>
            </dialog>
          </div>
          {detail.pendingEmailChange || detail.pendingPasswordReset ? (
            <p class="text-xs text-neutral-500">
              {detail.pendingEmailChange ? 'メール変更申請あり' : null}
              {detail.pendingEmailChange && detail.pendingPasswordReset ? ' · ' : null}
              {detail.pendingPasswordReset ? 'パスワードリセット申請あり' : null}
            </p>
          ) : null}
        </div>
      </section>
    </main>,
    { flash },
  )
}

export async function signupVerifyPage(c: Context<AppBindings>) {
  const token = c.req.query('token')
  if (!token) {
    return c.render(<main class="p-6">token がありません</main>)
  }
  const { verifySignup } = createContainer(c)
  try {
    await verifySignup.execute(
      {
        token,
        userAgent: c.req.header('user-agent') ?? '',
        ipAddress: c.req.header('cf-connecting-ip') ?? '',
      },
      c,
    )
    setFlash(c, 'メール検証完了')
    return c.redirect('/mypage')
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'verify failed'
    return c.render(
      <main class="p-6">
        <p>検証失敗: {msg}</p>
        <a href="/">トップ</a>
      </main>,
    )
  }
}
