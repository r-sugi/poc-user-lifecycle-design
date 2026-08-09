import { TTL } from '../../config'
import { Email } from '../../domain/shared/Email'
import { hoursFromNow, newId } from '../../lib/ids'
import { AppError } from '../../lib/errors'
import type { MailerGateway } from '../../gateways/MailerGateway'
import type { SeedSignupLabelRepository } from '../../repositories/SeedLabelRepositories'
import type { SignupVerificationRepository } from '../../repositories/SignupVerificationRepository'
import type { TokenIssuingService } from '../../services/TokenIssuingService'

export class ResendSignupVerificationUseCase {
  constructor(
    private readonly signups: SignupVerificationRepository,
    private readonly tokens: TokenIssuingService,
    private readonly mailer: MailerGateway,
    private readonly seedSignupLabels: SeedSignupLabelRepository,
  ) {}

  async execute(input: { email: string }) {
    const email = Email.create(input.email).toString()
    const existing = await this.signups.listByEmail(email)
    const latest = existing.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
    if (!latest) throw new AppError('not_found', 'No signup request', 404)
    if (latest.consumedAt) throw new AppError('already_verified', 'Already consumed', 400)

    const now = new Date()
    const createdAt = now.toISOString()
    const displayName = latest.displayName || email.split('@')[0] || 'User'
    await this.signups.consumeActiveByEmail(email, createdAt)
    const token = await this.tokens.issue()
    const id = newId('signup')
    await this.signups.insert({
      id,
      email,
      passwordHash: latest.passwordHash,
      displayName,
      tokenHash: token.hashHex,
      expiresAt: hoursFromNow(TTL.signupVerificationHours, now),
      consumedAt: null,
      createdAt,
    })
    // POC: 検証トップ用に raw token を保管（displayName は直前行から signup_verifications 経由で引き継ぎ）
    await this.seedSignupLabels.insert({
      signupVerificationId: id,
      initialStateLabel: 'メール確認待ち（再送後・有効）',
      rawToken: token.raw,
      createdAt,
    })
    const actionUrl = `${this.mailer.getBaseUrl()}/auth/signup/verify?token=${token.raw}`
    await this.mailer.send({
      to: email,
      subject: 'Signup verification (resend)',
      kind: 'signup_verification_resend',
      actionUrl,
    })
    return { ok: true as const, actionUrl }
  }
}
