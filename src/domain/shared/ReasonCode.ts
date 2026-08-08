const WITHDRAW_CODES = ['no_longer_needed', 'privacy', 'other'] as const
const BAN_CODES = ['abuse', 'spam', 'tos_violation'] as const

export type WithdrawReasonCode = (typeof WITHDRAW_CODES)[number]
export type BanReasonCode = (typeof BAN_CODES)[number]
export type ReasonCodeValue = WithdrawReasonCode | BanReasonCode

const WITHDRAW_REASON_LABEL_JA: Record<WithdrawReasonCode, string> = {
  no_longer_needed: '利用終了',
  privacy: 'プライバシー上の理由',
  other: 'その他',
}

const BAN_REASON_LABEL_JA: Record<BanReasonCode, string> = {
  abuse: '不正利用・迷惑行為',
  spam: 'スパム',
  tos_violation: '利用規約違反',
}

/** 表示用。未知コードはそのまま返す（設計書 §21.2） */
export function withdrawReasonLabelJa(code: string): string {
  return WITHDRAW_REASON_LABEL_JA[code as WithdrawReasonCode] ?? code
}

/** 表示用。未知コードはそのまま返す */
export function banReasonLabelJa(code: string): string {
  return BAN_REASON_LABEL_JA[code as BanReasonCode] ?? code
}

const STATUS_PREFIX_JA: Record<string, string> = {
  active: '有効',
  withdrawn: '退会',
  banned: 'BAN',
}

/** `user_status_events.type` 表示用（設計書のイベント種別） */
const STATUS_EVENT_TYPE_LABEL_JA: Record<string, string> = {
  activated: '有効化',
  withdrawn: '退会',
  withdraw_cancelled: '退会取消',
  banned: 'BAN',
  unbanned: 'BAN解除',
}

/** `user_status_events.actor_type` 表示用。admin は呼び出し側で email 等に置換可 */
const ACTOR_TYPE_LABEL_JA: Record<string, string> = {
  user: 'ユーザー',
  admin: '管理者',
  system: 'システム',
}

/** ステータスイベント種別の表示ラベル。未知コードはそのまま返す */
export function statusEventTypeLabelJa(type: string): string {
  return STATUS_EVENT_TYPE_LABEL_JA[type] ?? type
}

/** actor_type の表示ラベル。未知コードはそのまま返す */
export function actorTypeLabelJa(actorType: string): string {
  return ACTOR_TYPE_LABEL_JA[actorType] ?? actorType
}

/** `banned / abuse` → `BAN / 不正利用・迷惑行為` など表示用ローカライズ */
export function localizeLifecycleStateLabel(label: string): string {
  const trimmed = label.trim()
  const m = /^(active|withdrawn|banned)(\s*\/\s*)(.*)$/i.exec(trimmed)
  if (!m) return label
  const statusKey = m[1].toLowerCase()
  const statusJa = STATUS_PREFIX_JA[statusKey] ?? m[1]
  let detail = m[3]
  if (statusKey === 'banned') {
    // 理由コードのみ、または先頭トークンが理由コードの場合を置換
    const reason = detail.split(/\s|（/)[0]
    const ja = banReasonLabelJa(reason)
    if (ja !== reason) {
      detail = `${ja}${detail.slice(reason.length)}`
    }
  }
  return `${statusJa}${m[2]}${detail}`
}

export class ReasonCode {
  private constructor(
    readonly value: ReasonCodeValue,
    readonly kind: 'withdraw' | 'ban',
  ) {}

  static withdraw(raw: string): ReasonCode {
    if (!(WITHDRAW_CODES as readonly string[]).includes(raw)) {
      throw new Error(`invalid_withdraw_reason:${raw}`)
    }
    return new ReasonCode(raw as WithdrawReasonCode, 'withdraw')
  }

  static ban(raw: string): ReasonCode {
    if (!(BAN_CODES as readonly string[]).includes(raw)) {
      throw new Error(`invalid_ban_reason:${raw}`)
    }
    return new ReasonCode(raw as BanReasonCode, 'ban')
  }
}
