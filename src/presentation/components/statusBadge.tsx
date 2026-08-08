import { formatJst } from '../../lib/datetime'
import {
  actorTypeLabelJa,
  localizeLifecycleStateLabel,
  statusEventTypeLabelJa,
} from '../../domain/shared/ReasonCode'

export function StatusBadge(props: { status: string }) {
  const color =
    props.status === 'active'
      ? 'bg-emerald-100 text-emerald-900'
      : props.status === 'withdrawn'
        ? 'bg-amber-100 text-amber-900'
        : props.status === 'banned'
          ? 'bg-red-100 text-red-900'
          : 'bg-neutral-100 text-neutral-800'
  return (
    <span class={`inline-block rounded px-2 py-0.5 text-xs font-medium ${color}`}>
      {props.status}
    </span>
  )
}

/** 退会ステータス向け: 猶予期間と PII バッチの扱い */
function withdrawnPiiHint(label: string): string | null {
  const l = label.toLowerCase()
  if (!l.startsWith('withdrawn')) return null
  if (label.includes('経過') || label.includes('バッチ対象')) {
    return '30日経過後も日付だけでは消えません。PurgeWithdrawnPii バッチ実行後に profiles / identities を物理削除します。users(withdrawn) とイベント履歴は残ります。'
  }
  return '退会後30日未満は profiles / identities の PII は残り、削除バッチ対象外です。退会取消が可能です。'
}

function InfoHintIcon(props: { hint: string }) {
  return (
    <span
      class="inline-flex shrink-0 cursor-default text-amber-700/80 hover:text-amber-900"
      title={props.hint}
      aria-label={props.hint}
    >
      <svg class="h-3.5 w-3.5" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <path
          fill-rule="evenodd"
          d="M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14zm.75-10.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0zM8 6.5a.75.75 0 0 0-.75.75v3.5a.75.75 0 0 0 1.5 0v-3.5A.75.75 0 0 0 8 6.5z"
          clip-rule="evenodd"
        />
      </svg>
    </span>
  )
}

/** 検証用のライフサイクル状態ラベル（"active / …" など）向け */
export function StateChip(props: { label: string }) {
  const display = localizeLifecycleStateLabel(props.label)
  const l = props.label.toLowerCase()
  const withdrawnHint = withdrawnPiiHint(props.label)
  const color =
    l.startsWith('banned')
      ? 'bg-red-50 text-red-800 ring-red-200'
      : l.startsWith('withdrawn')
        ? 'bg-amber-50 text-amber-900 ring-amber-200'
        : l.includes('期限切れ') ||
            l.includes('無効') ||
            l.includes('消費済み') ||
            l.includes('expired')
          ? 'bg-neutral-100 text-neutral-600 ring-neutral-200'
          : l.includes('申請') || l.includes('pending')
            ? 'bg-sky-50 text-sky-900 ring-sky-200'
            : l.startsWith('active') || l.includes('確認待ち') || l.includes('有効')
              ? 'bg-emerald-50 text-emerald-900 ring-emerald-200'
              : 'bg-neutral-100 text-neutral-700 ring-neutral-200'
  return (
    <span class="inline-flex max-w-[18rem] items-center gap-1">
      <span
        class={`inline-block min-w-0 truncate rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${color}`}
        title={display}
      >
        {display}
      </span>
      {withdrawnHint ? <InfoHintIcon hint={withdrawnHint} /> : null}
    </span>
  )
}

export function EventTimeline(props: {
  events: Array<{
    seq: number
    type: string
    actorType: string
    createdAt: string
    /** admin 解決時の email 等。未解決時は省略し actor_type ラベルへフォールバック */
    actorName?: string | null
  }>
}) {
  if (props.events.length === 0) {
    return <p class="px-4 py-10 text-center text-sm text-neutral-500">イベントなし</p>
  }
  return (
    <div class="overflow-x-auto">
      <table class="min-w-full text-left">
        <thead class="border-b border-neutral-200 bg-neutral-50">
          <tr>
            <th class="whitespace-nowrap px-4 py-2.5 text-left text-xs font-medium tracking-wide text-neutral-500">
              seq
            </th>
            <th class="whitespace-nowrap px-4 py-2.5 text-left text-xs font-medium tracking-wide text-neutral-500">
              種別
            </th>
            <th class="whitespace-nowrap px-4 py-2.5 text-left text-xs font-medium tracking-wide text-neutral-500">
              実行者
            </th>
            <th class="whitespace-nowrap px-4 py-2.5 text-left text-xs font-medium tracking-wide text-neutral-500">
              日時
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-neutral-100">
          {props.events.map((e) => (
            <tr class="transition-colors hover:bg-neutral-50" key={`${e.seq}-${e.type}`}>
              <td class="px-4 py-3 align-middle font-mono text-xs text-neutral-600">#{e.seq}</td>
              <td class="px-4 py-3 align-middle text-sm font-medium text-neutral-900">
                {statusEventTypeLabelJa(e.type)}
              </td>
              <td class="px-4 py-3 align-middle text-sm text-neutral-800">
                {e.actorName?.trim() || actorTypeLabelJa(e.actorType)}
              </td>
              <td class="whitespace-nowrap px-4 py-3 align-middle font-mono text-xs text-neutral-600">
                {formatJst(e.createdAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function FlashBanner(props: { message?: string | null }) {
  if (!props.message) return null
  return (
    <div class="mb-4 whitespace-pre-line rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
      {props.message}
    </div>
  )
}

/** admin_session / user session 共通レイアウト先頭に表示する sticky 帯の中身 */
const sessionBannerClass =
  'border-b border-neutral-200 bg-neutral-100 px-4 py-2 text-center text-sm font-bold text-neutral-800'

/** admin_session があるとき共通レイアウト先頭に表示するバナー */
export function AdminSessionBanner(props: { name: string }) {
  return (
    <div class={sessionBannerClass}>
      管理者{props.name}としてログイン中
    </div>
  )
}

/** user session があるとき共通レイアウト先頭に表示するバナー */
export function UserSessionBanner(props: { name: string }) {
  return (
    <div class={sessionBannerClass}>
      ユーザー{props.name}としてログイン中
    </div>
  )
}
