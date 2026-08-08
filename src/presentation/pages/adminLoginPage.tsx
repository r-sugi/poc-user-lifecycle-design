import type { Context } from 'hono'
import type { AppBindings } from '../../container'
import { createContainer } from '../../container'
import { formatJst } from '../../lib/datetime'
import { consumeFlash } from '../../lib/flash'

const thClass =
  'whitespace-nowrap px-4 py-2.5 text-left text-xs font-medium tracking-wide text-neutral-500'
const tdClass = 'px-4 py-3 align-middle text-sm text-neutral-800'
const actionBtnClass =
  'inline-flex items-center rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50'

/** 検証用: シード管理者一覧 + ワンクリックログイン → /admin/users */
export async function adminLoginPage(c: Context<AppBindings>) {
  const { adminRepo, sessionService } = createContainer(c)
  const admins = await adminRepo.listAll()
  const session = await sessionService.resolveFromAdminCookie(c)
  const currentAdminId = session?.adminId ?? null
  const flash = consumeFlash(c)

  return c.render(
    <main class="mx-auto max-w-6xl space-y-8">
      <header class="space-y-2">
        <h1 class="text-3xl font-semibold tracking-tight">管理者ログイン</h1>
        <nav class="flex flex-wrap gap-3 text-sm">
          <a class="underline" href="/">
            トップへ
          </a>
        </nav>
      </header>

      <section class="space-y-3">
        <div class="flex items-baseline justify-between gap-3">
          <h2 class="text-xl font-medium">管理者ユーザー</h2>
          <span class="text-xs text-neutral-500">{admins.length} 件</span>
        </div>

        {admins.length === 0 ? (
          <div class="rounded-lg border border-dashed border-neutral-300 bg-white px-4 py-10 text-center text-sm text-neutral-500">
            管理者がありません（seed を実行してください）
          </div>
        ) : (
          <div class="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
            <div class="overflow-x-auto">
              <table class="min-w-full text-left">
                <thead class="border-b border-neutral-200 bg-neutral-50">
                  <tr>
                    <th class={thClass}>email（PII）</th>
                    <th class={thClass}>作成日時</th>
                    <th class={thClass}>アクション</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-neutral-100">
                  {admins.map((a) => {
                    const isCurrent = currentAdminId === a.id
                    return (
                      <tr
                        class={`transition-colors ${isCurrent ? 'bg-sky-50/80' : 'hover:bg-neutral-50'}`}
                        key={a.id}
                      >
                        <td class={tdClass}>
                          <div class="flex flex-col gap-0.5">
                            <span class="font-medium text-neutral-900">{a.email}</span>
                            <span class="text-xs text-neutral-500">
                              {a.id}
                              {isCurrent ? (
                                <span class="ml-2 rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-sky-800">
                                  ログイン中
                                </span>
                              ) : null}
                            </span>
                          </div>
                        </td>
                        <td class={`${tdClass} whitespace-nowrap font-mono text-xs text-neutral-600`}>
                          {formatJst(a.createdAt)}
                        </td>
                        <td class={tdClass}>
                          {isCurrent ? (
                            <div class="flex flex-wrap gap-2">
                              <a
                                class="inline-flex items-center rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                                href="/admin/users"
                              >
                                ユーザー一覧
                              </a>
                              <form method="post" action="/dev/logout-admin" class="inline">
                                <button
                                  type="submit"
                                  class="inline-flex items-center rounded-md bg-neutral-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-neutral-700"
                                >
                                  ログアウト
                                </button>
                              </form>
                            </div>
                          ) : (
                            <form method="post" action="/dev/login-as-admin" class="inline">
                              <input type="hidden" name="adminId" value={a.id} />
                              <input type="hidden" name="redirect" value="/admin/users" />
                              <button type="submit" class={actionBtnClass}>
                                ログイン
                              </button>
                            </form>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </main>,
    { flash },
  )
}
