import { ActorType, StatusEventType } from '../../domain/shared/StatusEventEnums'
import { AppError } from '../../lib/errors'
import { newId } from '../../lib/ids'
import type { Db } from '../../db/client'
import {
  signupVerifications,
  userIdentities,
  userProfiles,
  userStatusEvents,
  users,
} from '../../db/schema'
import { eq } from 'drizzle-orm'
import type { SeedSignupLabelRepository } from '../../repositories/SeedLabelRepositories'
import type { SignupVerificationRepository } from '../../repositories/SignupVerificationRepository'
import type { UserProfileRepository } from '../../repositories/UserProfileRepository'
import type { SessionService } from '../../services/SessionService'
import type { TokenIssuingService } from '../../services/TokenIssuingService'
import type { Context } from 'hono'

export class VerifySignupUseCase {
  constructor(
    private readonly db: Db,
    private readonly signups: SignupVerificationRepository,
    private readonly profiles: UserProfileRepository,
    private readonly tokens: TokenIssuingService,
    private readonly sessions: SessionService,
    private readonly seedSignupLabels: SeedSignupLabelRepository,
  ) {}

  async execute(
    input: { token: string; userAgent?: string; ipAddress?: string },
    c?: Context,
  ) {
    const hash = await this.tokens.hashRaw(input.token)
    const row = await this.signups.findByTokenHash(hash)
    if (!row) throw new AppError('invalid_token', 'Invalid token', 400)
    if (row.consumedAt) throw new AppError('token_consumed', 'Token already used', 400)
    if (new Date(row.expiresAt).getTime() <= Date.now()) {
      throw new AppError('token_expired', 'Token expired', 400)
    }

    const existingProfile = await this.profiles.findByEmail(row.email)
    if (existingProfile) throw new AppError('email_taken', 'Email already registered', 409)

    const now = new Date().toISOString()
    const userId = newId('user')
    const label = await this.seedSignupLabels.findBySignupId(row.id)
    const displayName = label?.displayName || row.email.split('@')[0] || 'User'

    try {
      await this.db.batch([
        this.db.insert(users).values({
          id: userId,
          status: 'active',
          lastSeq: 1,
          verifiedAt: now,
          createdAt: now,
          updatedAt: now,
        }),
        this.db.insert(userProfiles).values({
          userId,
          email: row.email,
          displayName,
          createdAt: now,
          updatedAt: now,
        }),
        this.db.insert(userIdentities).values({
          id: newId('id'),
          userId,
          provider: 'password',
          providerUid: userId,
          passwordHash: row.passwordHash,
          createdAt: now,
        }),
        this.db.insert(userStatusEvents).values({
          userId,
          seq: 1,
          type: StatusEventType.Activated,
          actorType: ActorType.User,
          createdAt: now,
        }),
        this.db
          .update(signupVerifications)
          .set({ consumedAt: now })
          .where(eq(signupVerifications.id, row.id)),
      ])
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw new AppError('email_taken', 'Email already registered', 409)
      }
      throw e
    }

    await this.sessions.issueUserSession(
      userId,
      {
        userAgent: input.userAgent ?? '',
        ipAddress: input.ipAddress ?? '',
      },
      c,
    )

    return { userId }
  }
}

function isUniqueViolation(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false
  const msg = 'message' in e && typeof e.message === 'string' ? e.message : String(e)
  return /UNIQUE|unique|constraint/i.test(msg)
}
