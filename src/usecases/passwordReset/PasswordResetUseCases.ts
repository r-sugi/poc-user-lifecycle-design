import { TTL } from '../../config'
import { Email } from '../../domain/shared/Email'
import { Password } from '../../domain/shared/Password'
import { AppError } from '../../lib/errors'
import { hoursFromNow, newId } from '../../lib/ids'
import type { MailerGateway } from '../../gateways/MailerGateway'
import type { SessionRevocationQueueGateway } from '../../gateways/SessionRevocationQueueGateway'
import type { PasswordResetRepository } from '../../repositories/PasswordResetRepository'
import type { UserIdentityRepository } from '../../repositories/UserIdentityRepository'
import type { UserProfileRepository } from '../../repositories/UserProfileRepository'
import type { PasswordHashingService } from '../../services/PasswordHashingService'
import type { TokenIssuingService } from '../../services/TokenIssuingService'

export class RequestPasswordResetUseCase {
  constructor(
    private readonly profiles: UserProfileRepository,
    private readonly identities: UserIdentityRepository,
    private readonly resets: PasswordResetRepository,
    private readonly tokens: TokenIssuingService,
    private readonly mailer: MailerGateway,
  ) {}

  async execute(input: { email: string }) {
    const email = Email.create(input.email).toString()
    const profile = await this.profiles.findByEmail(email)
    // 列挙防止: 存在しなくても ok。Google のみ identity もトークン発行せず ok
    if (!profile) return { ok: true as const }
    const passwordIdentity = await this.identities.findPasswordIdentity(profile.userId)
    if (!passwordIdentity?.passwordHash) return { ok: true as const }

    const token = await this.tokens.issue()
    const now = new Date()
    await this.resets.insert({
      id: newId('pwreset'),
      userId: profile.userId,
      tokenHash: token.hashHex,
      expiresAt: hoursFromNow(TTL.passwordResetHours, now),
      consumedAt: null,
      createdAt: now.toISOString(),
      rawToken: token.raw,
    })
    const actionUrl = `${this.mailer.getBaseUrl()}/password/reset?token=${token.raw}`
    await this.mailer.send({
      to: email,
      subject: 'Password reset',
      kind: 'password_reset',
      actionUrl,
    })
    return { ok: true as const, actionUrl }
  }
}

export class ResetPasswordUseCase {
  constructor(
    private readonly resets: PasswordResetRepository,
    private readonly identities: UserIdentityRepository,
    private readonly tokens: TokenIssuingService,
    private readonly hashing: PasswordHashingService,
    private readonly queue: SessionRevocationQueueGateway,
  ) {}

  async execute(input: { token: string; password: string }) {
    Password.create(input.password)
    const hash = await this.tokens.hashRaw(input.token)
    const row = await this.resets.findByTokenHash(hash)
    if (!row) throw new AppError('invalid_token', 'Invalid token', 400)
    if (row.consumedAt) throw new AppError('token_consumed', 'Token used', 400)
    if (new Date(row.expiresAt).getTime() <= Date.now()) {
      throw new AppError('token_expired', 'Token expired', 400)
    }
    const identity = await this.identities.findPasswordIdentity(row.userId)
    if (!identity) throw new AppError('no_password_identity', 'No password identity', 409)
    const passwordHash = await this.hashing.hash(input.password)
    await this.identities.updatePasswordHash(identity.id, passwordHash)
    await this.resets.markConsumed(row.id, new Date().toISOString())
    await this.queue.enqueue({ userId: row.userId, reason: 'password_reset' })
    return { ok: true as const }
  }
}
