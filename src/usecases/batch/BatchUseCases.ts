import { and, eq, isNotNull, lt, or } from 'drizzle-orm'
import { TTL } from '../../config'
import type { Db } from '../../db/client'
import {
  emailChangeRequests,
  passwordResets,
  signupVerifications,
  userIdentities,
  userProfiles,
  userStatusEvents,
  users,
} from '../../db/schema'
import { AppError } from '../../lib/errors'
import type { UserRepository } from '../../repositories/UserRepository'

/** profiles / identities を物理削除。既に無ければ false。 */
export async function purgeUserPii(db: Db, userId: string): Promise<boolean> {
  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.userId, userId),
  })
  if (!profile) return false

  await db.delete(userIdentities).where(eq(userIdentities.userId, userId))
  await db.delete(userProfiles).where(eq(userProfiles.userId, userId))
  return true
}

export class PurgeWithdrawnPiiUseCase {
  constructor(private readonly db: Db) {}

  async execute(now = new Date()): Promise<{ purgedUserIds: string[] }> {
    const graceMs = TTL.withdrawGraceDays * 24 * 60 * 60 * 1000
    const cutoff = new Date(now.getTime() - graceMs).toISOString()

    const withdrawn = await this.db.select().from(users).where(eq(users.status, 'withdrawn'))
    const purgedUserIds: string[] = []

    for (const u of withdrawn) {
      const events = await this.db
        .select()
        .from(userStatusEvents)
        .where(and(eq(userStatusEvents.userId, u.id), eq(userStatusEvents.type, 'withdrawn')))
      const latest = events.sort(
        (a: { seq: number }, b: { seq: number }) => b.seq - a.seq,
      )[0]
      if (!latest) continue
      if (latest.createdAt > cutoff) continue

      if (await purgeUserPii(this.db, u.id)) {
        purgedUserIds.push(u.id)
      }
    }

    return { purgedUserIds }
  }
}

/** 管理画面からの強制実行。banned / withdrawn のみ、猶予を見ない。 */
export class ForcePurgeUserPiiUseCase {
  constructor(
    private readonly db: Db,
    private readonly users: UserRepository,
  ) {}

  async execute(input: { userId: string }): Promise<{ purged: true }> {
    const user = await this.users.findById(input.userId)
    if (!user) throw new AppError('not_found', 'User not found', 404)

    const status = user.getStatus().raw
    if (status !== 'withdrawn' && status !== 'banned') {
      throw new AppError(
        'invalid_status',
        'PII purge is only allowed for banned or withdrawn users',
        400,
      )
    }

    const purged = await purgeUserPii(this.db, input.userId)
    if (!purged) {
      throw new AppError('already_purged', 'PII already deleted', 400)
    }
    return { purged: true }
  }
}

export class PurgeExpiredTokensUseCase {
  constructor(private readonly db: Db) {}

  async execute(now = new Date()): Promise<{
    signup: number
    passwordReset: number
    emailChange: number
  }> {
    const nowIso = now.toISOString()

    // 消費済み OR 期限切れ
    const signupRes = await this.db
      .delete(signupVerifications)
      .where(
        or(isNotNull(signupVerifications.consumedAt), lt(signupVerifications.expiresAt, nowIso)),
      )
      .returning({ id: signupVerifications.id })

    const pwRes = await this.db
      .delete(passwordResets)
      .where(or(isNotNull(passwordResets.consumedAt), lt(passwordResets.expiresAt, nowIso)))
      .returning({ id: passwordResets.id })

    const emailRes = await this.db
      .delete(emailChangeRequests)
      .where(
        or(isNotNull(emailChangeRequests.consumedAt), lt(emailChangeRequests.expiresAt, nowIso)),
      )
      .returning({ id: emailChangeRequests.id })

    return {
      signup: signupRes.length,
      passwordReset: pwRes.length,
      emailChange: emailRes.length,
    }
  }
}
