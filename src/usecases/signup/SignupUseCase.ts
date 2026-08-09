import { TTL } from '../../config'
import { Email } from '../../domain/shared/Email'
import { Password } from '../../domain/shared/Password'
import { hoursFromNow, newId } from '../../lib/ids'
import { AppError } from '../../lib/errors'
import type { MailerGateway } from '../../gateways/MailerGateway'
import type { SeedSignupLabelRepository } from '../../repositories/SeedLabelRepositories'
import type { SignupVerificationRepository } from '../../repositories/SignupVerificationRepository'
import type { UserProfileRepository } from '../../repositories/UserProfileRepository'
import type { PasswordHashingService } from '../../services/PasswordHashingService'
import type { TokenIssuingService } from '../../services/TokenIssuingService'

export class SignupUseCase {
  constructor(
    private readonly signups: SignupVerificationRepository,
    private readonly profiles: UserProfileRepository,
    private readonly hashing: PasswordHashingService,
    private readonly tokens: TokenIssuingService,
    private readonly mailer: MailerGateway,
    private readonly seedSignupLabels: SeedSignupLabelRepository,
  ) {}

  async execute(input: { email: string; password: string; displayName: string }) {
    const email = Email.create(input.email).toString()
    Password.create(input.password)
    const existing = await this.profiles.findByEmail(email)
    if (existing) throw new AppError('email_taken', 'Email already registered', 409)

    const now = new Date()
    const token = await this.tokens.issue()
    const passwordHash = await this.hashing.hash(input.password)
    const id = newId('signup')
    const createdAt = now.toISOString()
    await this.signups.consumeActiveByEmail(email, createdAt)
    await this.signups.insert({
      id,
      email,
      passwordHash,
      displayName: input.displayName,
      tokenHash: token.hashHex,
      expiresAt: hoursFromNow(TTL.signupVerificationHours, now),
      consumedAt: null,
      createdAt,
    })
    // POC: 検証トップ用に raw token を保管（displayName は signup_verifications 本体に保持）
    await this.seedSignupLabels.insert({
      signupVerificationId: id,
      initialStateLabel: 'メール確認待ち（有効）',
      rawToken: token.raw,
      createdAt,
    })

    const actionUrl = `${this.mailer.getBaseUrl()}/auth/signup/verify?token=${token.raw}`
    await this.mailer.send({
      to: email,
      subject: 'Signup verification',
      kind: 'signup_verification',
      actionUrl,
      body: `displayName=${input.displayName}`,
    })
    return { ok: true as const, signupId: id, actionUrl }
  }
}
