import type { Context } from 'hono'
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
import { and, eq, isNull } from 'drizzle-orm'
import type { GoogleAuthMockGateway } from '../../gateways/GoogleAuthMockGateway'
import type { UserIdentityRepository } from '../../repositories/UserIdentityRepository'
import type { UserProfileRepository } from '../../repositories/UserProfileRepository'
import type { UserRepository } from '../../repositories/UserRepository'
import type { SessionService } from '../../services/SessionService'

export class GoogleLoginUseCase {
  constructor(
    private readonly db: Db,
    private readonly users: UserRepository,
    private readonly profiles: UserProfileRepository,
    private readonly identities: UserIdentityRepository,
    private readonly google: GoogleAuthMockGateway,
    private readonly sessions: SessionService,
  ) {}

  startUrl(baseUrl: string, email: string, name: string): string {
    const sub = `google-sub-${email.toLowerCase()}`
    const code = this.google.encodeCode({ email, name, sub })
    return `${baseUrl.replace(/\/$/, '')}/auth/google/callback?code=${encodeURIComponent(code)}`
  }

  async callback(
    input: { code: string; userAgent?: string; ipAddress?: string },
    c?: Context,
  ) {
    const profile = this.google.decodeCode(decodeURIComponent(input.code))
    const email = profile.email.toLowerCase()
    const existingIdentity = await this.identities.findByProvider('google', profile.sub)
    let userId: string

    if (existingIdentity) {
      userId = existingIdentity.userId
      const user = await this.users.findById(userId)
      if (!user) throw new AppError('not_found', 'User missing', 404)
      const st = user.getStatus().raw
      if (st === 'banned' || st === 'withdrawn') {
        throw new AppError(st, `User is ${st}`, 403)
      }
    } else {
      const byEmail = await this.profiles.findByEmail(email)
      if (byEmail) {
        userId = byEmail.userId
        const user = await this.users.findById(userId)
        if (!user) throw new AppError('not_found', 'User missing', 404)
        const st = user.getStatus().raw
        if (st === 'banned' || st === 'withdrawn') {
          throw new AppError(st, `User is ${st}`, 403)
        }
        await this.identities.insert({
          id: newId('id'),
          userId,
          provider: 'google',
          providerUid: profile.sub,
          passwordHash: null,
          createdAt: new Date().toISOString(),
        })
      } else {
        userId = newId('user')
        const now = new Date().toISOString()
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
            email,
            displayName: profile.name || email.split('@')[0],
            createdAt: now,
            updatedAt: now,
          }),
          this.db.insert(userIdentities).values({
            id: newId('id'),
            userId,
            provider: 'google',
            providerUid: profile.sub,
            passwordHash: null,
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
            .where(
              and(eq(signupVerifications.email, email), isNull(signupVerifications.consumedAt)),
            ),
        ])
      }
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
