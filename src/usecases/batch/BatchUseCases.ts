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

      const profile = await this.db.query.userProfiles.findFirst({
        where: eq(userProfiles.userId, u.id),
      })
      if (!profile) continue // 既にパージ済み

      await this.db.delete(userIdentities).where(eq(userIdentities.userId, u.id))
      await this.db.delete(userProfiles).where(eq(userProfiles.userId, u.id))
      purgedUserIds.push(u.id)
    }

    return { purgedUserIds }
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
