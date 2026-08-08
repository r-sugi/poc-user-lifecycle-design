import type { CurrentLifecycleStateResolver } from '../../services/CurrentLifecycleStateResolver'
import type { EmailChangeRequestRepository } from '../../repositories/EmailChangeRequestRepository'
import type { PasswordResetRepository } from '../../repositories/PasswordResetRepository'
import type { SeedSignupLabelRepository } from '../../repositories/SeedLabelRepositories'
import type { SeedUserLabelRepository } from '../../repositories/SeedLabelRepositories'
import type { SignupVerificationRepository } from '../../repositories/SignupVerificationRepository'
import type { UserBanRepository } from '../../repositories/UserBanRepository'
import type { UserIdentityRepository } from '../../repositories/UserIdentityRepository'
import type { UserProfileRepository } from '../../repositories/UserProfileRepository'
import type { UserRepository } from '../../repositories/UserRepository'
import type { UserStatusEventRepository } from '../../repositories/UserStatusEventRepository'
import type { UserStatusValue } from '../../domain/user/UserStatus'

export type ConfirmedLoginAction =
  | { kind: 'dev-login' }
  | { kind: 'disabled'; reason: string }

export type HomeConfirmedRow = {
  userId: string
  email: string
  displayName: string
  initialState: string
  currentState: string
  status: string
  /** 当該セッション以外の行向け。banned/withdrawn は disabled */
  loginAction: ConfirmedLoginAction
  /**
   * 未消費かつ期限内の password_resets.raw_token（POC）。
   * 無ければ null → 検証トップで「PW更新」を出さない
   */
  pendingPasswordResetToken: string | null
}

export type SignupAction =
  | { kind: 'verify'; href: string }
  | { kind: 'resend'; email: string }
  | { kind: 'disabled'; reason: string }

export type HomeSignupRow = {
  id: string
  email: string
  displayName: string
  createdAt: string
  expiresAt: string
  consumedAt: string | null
  initialState: string
  currentState: string
  action: SignupAction
}

export class ListVerificationHomeUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly profiles: UserProfileRepository,
    private readonly identities: UserIdentityRepository,
    private readonly events: UserStatusEventRepository,
    private readonly bans: UserBanRepository,
    private readonly emailChanges: EmailChangeRequestRepository,
    private readonly passwordResets: PasswordResetRepository,
    private readonly signups: SignupVerificationRepository,
    private readonly seedUserLabels: SeedUserLabelRepository,
    private readonly seedSignupLabels: SeedSignupLabelRepository,
    private readonly resolver: CurrentLifecycleStateResolver,
  ) {}

  async execute(): Promise<{ confirmed: HomeConfirmedRow[]; signups: HomeSignupRow[] }> {
    const allUsers = await this.users.listAll()
    const confirmed: HomeConfirmedRow[] = []

    for (const user of allUsers) {
      const userId = user.id.toString()
      const profile = await this.profiles.findByUserId(userId)
      if (!profile) continue
      const identities = await this.identities.listByUserId(userId)
      const providers = identities
        .map((i) => i.provider)
        .filter((p): p is 'password' | 'google' => p === 'password' || p === 'google')
      const events = await this.events.listByUserId(userId)
      const status = user.getStatus().raw as UserStatusValue
      let banReasonCode: string | null = null
      if (status === 'banned') {
        const ban = await this.bans.findLatestForUser(userId)
        banReasonCode = ban?.ban.reasonCode ?? null
      }
      let withdrawnAt: string | null = null
      if (status === 'withdrawn') {
        const w = events.filter((e) => e.type === 'withdrawn').at(-1)
        withdrawnAt = w?.createdAt ?? null
      }
      const hasPendingPasswordReset = await this.passwordResets.hasPending(userId)
      const pendingPasswordResetToken =
        providers.includes('password') && hasPendingPasswordReset
          ? await this.passwordResets.findLatestPendingRawToken(userId)
          : null
      const current = this.resolver.resolveForConfirmedUser({
        status,
        providers,
        hasPendingEmailChange: await this.emailChanges.hasPending(userId),
        hasPendingPasswordReset,
        events: events.map((e) => ({ type: e.type, createdAt: e.createdAt })),
        banReasonCode,
        withdrawnAt,
      })
      const initial =
        (await this.seedUserLabels.findByUserId(userId)) ?? current.toString()
      confirmed.push({
        userId,
        email: profile.email,
        displayName: profile.displayName,
        initialState: initial,
        currentState: current.toString(),
        status,
        loginAction:
          status === 'banned'
            ? { kind: 'disabled', reason: 'BAN中' }
            : status === 'withdrawn'
              ? { kind: 'disabled', reason: '退会中' }
              : { kind: 'dev-login' },
        pendingPasswordResetToken,
      })
    }

    confirmed.sort((a, b) => a.email.localeCompare(b.email))

    const signupRows = await this.signups.listAll()
    const byEmail = new Map<string, typeof signupRows>()
    for (const s of signupRows) {
      const list = byEmail.get(s.email) ?? []
      list.push(s)
      byEmail.set(s.email, list)
    }

    const now = Date.now()
    const signups: HomeSignupRow[] = []
    for (const row of signupRows) {
      const siblings = byEmail.get(row.email) ?? []
      const hasNewerValidSibling = siblings.some(
        (s) =>
          s.id !== row.id &&
          !s.consumedAt &&
          new Date(s.expiresAt).getTime() > now &&
          s.createdAt > row.createdAt,
      )
      const isResendCurrent =
        !row.consumedAt &&
        new Date(row.expiresAt).getTime() > now &&
        siblings.some((s) => s.id !== row.id && !!s.consumedAt)
      const current = this.resolver.resolveForSignupVerification({
        expiresAt: row.expiresAt,
        consumedAt: row.consumedAt,
        hasNewerValidSibling,
        isResendCurrent,
      })
      const labelRow = await this.seedSignupLabels.findBySignupId(row.id)
      const initial = labelRow?.initialStateLabel ?? current.toString()
      const displayName = labelRow?.displayName || row.email.split('@')[0] || 'User'
      const action = this.buildSignupAction({
        email: row.email,
        expiresAt: row.expiresAt,
        consumedAt: row.consumedAt,
        hasNewerValidSibling,
        rawToken: labelRow?.rawToken ?? null,
        now,
      })
      signups.push({
        id: row.id,
        email: row.email,
        displayName,
        createdAt: row.createdAt,
        expiresAt: row.expiresAt,
        consumedAt: row.consumedAt,
        initialState: initial,
        currentState: current.toString(),
        action,
      })
    }
    signups.sort((a, b) => b.createdAt.localeCompare(a.createdAt))

    return { confirmed, signups }
  }

  private buildSignupAction(input: {
    email: string
    expiresAt: string
    consumedAt: string | null
    hasNewerValidSibling: boolean
    rawToken: string | null
    now: number
  }): SignupAction {
    if (input.consumedAt) {
      return { kind: 'disabled', reason: '消費済み' }
    }
    if (new Date(input.expiresAt).getTime() <= input.now) {
      return { kind: 'resend', email: input.email }
    }
    if (input.hasNewerValidSibling) {
      return { kind: 'disabled', reason: '再送で無効化' }
    }
    if (!input.rawToken) {
      return { kind: 'disabled', reason: 'トークン未保管' }
    }
    return {
      kind: 'verify',
      href: `/auth/signup/verify?token=${encodeURIComponent(input.rawToken)}`,
    }
  }
}
