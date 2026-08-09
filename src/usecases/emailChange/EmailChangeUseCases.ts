import { TTL } from '../../config'
import { Email } from '../../domain/shared/Email'
import { Password } from '../../domain/shared/Password'
import { AppError } from '../../lib/errors'
import { hoursFromNow, newId } from '../../lib/ids'
import type { MailerGateway } from '../../gateways/MailerGateway'
import type { SessionRevocationQueueGateway } from '../../gateways/SessionRevocationQueueGateway'
import type { EmailChangeRequestRepository } from '../../repositories/EmailChangeRequestRepository'
import type { UserIdentityRepository } from '../../repositories/UserIdentityRepository'
import type { UserProfileRepository } from '../../repositories/UserProfileRepository'
import type { PasswordHashingService } from '../../services/PasswordHashingService'
import type { TokenIssuingService } from '../../services/TokenIssuingService'

export class RequestEmailChangeUseCase {
  constructor(
    private readonly profiles: UserProfileRepository,
    private readonly requests: EmailChangeRequestRepository,
    private readonly tokens: TokenIssuingService,
    private readonly mailer: MailerGateway,
  ) {}

  async execute(input: { userId: string; newEmail: string }) {
    const newEmail = Email.create(input.newEmail).toString()
    const taken = await this.profiles.findByEmail(newEmail)
    if (taken) throw new AppError('email_taken', 'Email taken', 409)
    const profile = await this.profiles.findByUserId(input.userId)
    if (!profile) throw new AppError('not_found', 'Profile missing', 404)
    const token = await this.tokens.issue()
    const now = new Date()
    await this.requests.insert({
      id: newId('emchange'),
      userId: input.userId,
      newEmail,
      tokenHash: token.hashHex,
      expiresAt: hoursFromNow(TTL.emailChangeHours, now),
      consumedAt: null,
      createdAt: now.toISOString(),
    })
    const actionUrl = `${this.mailer.getBaseUrl()}/email-change/verify?token=${token.raw}`
    await this.mailer.send({
      to: newEmail,
      subject: 'Confirm email change',
      kind: 'email_change',
      actionUrl,
    })
    await this.mailer.send({
      to: profile.email,
      subject: 'Email change requested',
      kind: 'email_change_notify_old',
      actionUrl: `${this.mailer.getBaseUrl()}/mypage`,
      body: `New email requested: ${newEmail}`,
    })
    return { ok: true as const, actionUrl }
  }
}

export class VerifyEmailChangeUseCase {
  constructor(
    private readonly requests: EmailChangeRequestRepository,
    private readonly profiles: UserProfileRepository,
    private readonly tokens: TokenIssuingService,
  ) {}

  async execute(input: { token: string }) {
    const hash = await this.tokens.hashRaw(input.token)
    const row = await this.requests.findByTokenHash(hash)
    if (!row) throw new AppError('invalid_token', 'Invalid token', 400)
    if (row.consumedAt) throw new AppError('token_consumed', 'Token used', 400)
    if (new Date(row.expiresAt).getTime() <= Date.now()) {
      throw new AppError('token_expired', 'Token expired', 400)
    }
    const taken = await this.profiles.findByEmail(row.newEmail)
    if (taken && taken.userId !== row.userId) {
      throw new AppError('email_taken', 'Email taken', 409)
    }
    const now = new Date().toISOString()
    try {
      await this.profiles.update(row.userId, { email: row.newEmail, updatedAt: now })
    } catch (e) {
      if (isUniqueViolation(e)) throw new AppError('email_taken', 'Email taken', 409)
      throw e
    }
    await this.requests.markConsumed(row.id, now)
    return { ok: true as const, email: row.newEmail }
  }
}

function isUniqueViolation(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false
  const msg = 'message' in e && typeof e.message === 'string' ? e.message : String(e)
  return /UNIQUE|unique|constraint/i.test(msg)
}

export class ChangePasswordUseCase {
  constructor(
    private readonly identities: UserIdentityRepository,
    private readonly hashing: PasswordHashingService,
    private readonly queue: SessionRevocationQueueGateway,
  ) {}

  async execute(input: { userId: string; currentPassword: string; newPassword: string }) {
    Password.create(input.newPassword)
    const identity = await this.identities.findPasswordIdentity(input.userId)
    if (!identity?.passwordHash) throw new AppError('no_password_identity', 'No password', 409)
    const ok = await this.hashing.verify(input.currentPassword, identity.passwordHash)
    if (!ok) throw new AppError('invalid_credentials', 'Current password mismatch', 401)
    const passwordHash = await this.hashing.hash(input.newPassword)
    await this.identities.updatePasswordHash(identity.id, passwordHash)
    await this.queue.enqueue({ userId: input.userId, reason: 'password_change' })
    return { ok: true as const }
  }
}
