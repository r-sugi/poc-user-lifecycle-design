import { TTL } from '../config'
import { UserLifecycleStateLabel } from '../domain/shared/UserLifecycleStateLabel'
import type { UserStatusValue } from '../domain/user/UserStatus'

export type ConfirmedUserResolveInput = {
  status: UserStatusValue
  providers: Array<'password' | 'google'>
  hasPendingEmailChange: boolean
  hasPendingPasswordReset: boolean
  /** 直近の status events（新しい順でも古い順でも可。Resolver 内で走査） */
  events: Array<{ type: string; createdAt: string }>
  /** 直近の有効な BAN reason（status=banned 時） */
  banReasonCode?: string | null
  /** withdrawn の退会 event 時刻（ISO）。退会後 PII 削除待機（既定 30 日）の判定用 */
  withdrawnAt?: string | null
  nowIso?: string
}

export type SignupVerificationResolveInput = {
  expiresAt: string
  consumedAt: string | null
  /** 同一 email に有効・未消費の別行がある（再送旧行の判定用） */
  hasNewerValidSibling?: boolean
  /** 再送ペアの現行有効行 */
  isResendCurrent?: boolean
  nowIso?: string
}

/**
 * 検証トップ「現在の状態」合成（設計書 §16.2.3）
 */
export class CurrentLifecycleStateResolver {
  resolveForConfirmedUser(input: ConfirmedUserResolveInput): UserLifecycleStateLabel {
    const now = input.nowIso ? new Date(input.nowIso) : new Date()

    if (input.status === 'withdrawn') {
      const days = TTL.withdrawGraceDays
      const overdueLabel = `withdrawn / 退会後${days}日経過（PII削除バッチ対象）`
      const withdrawnAt = input.withdrawnAt ? new Date(input.withdrawnAt) : null
      if (withdrawnAt) {
        const graceMs = days * 24 * 60 * 60 * 1000
        const elapsedMs = now.getTime() - withdrawnAt.getTime()
        if (elapsedMs >= graceMs) {
          return UserLifecycleStateLabel.of(overdueLabel)
        }
        const remainDays = Math.max(1, Math.ceil((graceMs - elapsedMs) / (24 * 60 * 60 * 1000)))
        return UserLifecycleStateLabel.of(
          `withdrawn / 退会後${days}日未満（取消可・PII残・残り${remainDays}日）`,
        )
      }
      return UserLifecycleStateLabel.of(`withdrawn / 退会後${days}日未満（取消可・PII残）`)
    }

    if (input.status === 'banned') {
      const code = input.banReasonCode?.trim() || 'abuse'
      return UserLifecycleStateLabel.of(`banned / ${code}`)
    }

    // active
    const types = new Set(input.events.map((e) => e.type))
    const latestCancel = this.latestEvent(input.events, 'withdraw_cancelled')
    const latestUnban = this.latestEvent(input.events, 'unbanned')

    if (types.has('withdraw_cancelled') || types.has('unbanned')) {
      if (latestCancel && latestUnban) {
        const preferCancel =
          new Date(latestCancel.createdAt).getTime() >= new Date(latestUnban.createdAt).getTime()
        return UserLifecycleStateLabel.of(
          preferCancel
            ? 'active / 退会取消済み（履歴あり）'
            : 'active / BAN解除済み（履歴あり）',
        )
      }
      if (types.has('withdraw_cancelled')) {
        return UserLifecycleStateLabel.of('active / 退会取消済み（履歴あり）')
      }
      return UserLifecycleStateLabel.of('active / BAN解除済み（履歴あり）')
    }

    if (input.hasPendingEmailChange) {
      return UserLifecycleStateLabel.of('active / メール変更申請中')
    }
    if (input.hasPendingPasswordReset) {
      return UserLifecycleStateLabel.of('active / パスワードリセット未消費')
    }

    const hasPassword = input.providers.includes('password')
    const hasGoogle = input.providers.includes('google')
    if (hasPassword && hasGoogle) {
      return UserLifecycleStateLabel.of('active / password+Google')
    }
    if (hasGoogle) {
      return UserLifecycleStateLabel.of('active / Googleのみ')
    }
    if (hasPassword) {
      return UserLifecycleStateLabel.of('active / passwordのみ')
    }
    return UserLifecycleStateLabel.of('active')
  }

  resolveForSignupVerification(input: SignupVerificationResolveInput): UserLifecycleStateLabel {
    const now = input.nowIso ? new Date(input.nowIso) : new Date()
    if (input.consumedAt) {
      if (input.hasNewerValidSibling) {
        return UserLifecycleStateLabel.of('メール確認待ち（再送で無効化した旧行）')
      }
      return UserLifecycleStateLabel.of('メール確認待ち（消費済み・users作成済）')
    }
    const expired = new Date(input.expiresAt).getTime() <= now.getTime()
    if (expired) {
      return UserLifecycleStateLabel.of('メール確認待ち（期限切れ）')
    }
    if (input.isResendCurrent) {
      return UserLifecycleStateLabel.of('メール確認待ち（再送後・有効）')
    }
    return UserLifecycleStateLabel.of('メール確認待ち（有効）')
  }

  private latestEvent(
    events: Array<{ type: string; createdAt: string }>,
    type: string,
  ): { type: string; createdAt: string } | null {
    const matched = events.filter((e) => e.type === type)
    if (matched.length === 0) return null
    return matched.reduce((a, b) =>
      new Date(a.createdAt).getTime() >= new Date(b.createdAt).getTime() ? a : b,
    )
  }
}
