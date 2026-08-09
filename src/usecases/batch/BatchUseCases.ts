import { and, eq, inArray, isNotNull, lt, or, sql } from 'drizzle-orm'
import { TTL } from '../../config'
import type { Db } from '../../db/client'
import {
  adminAuditLogs,
  emailChangeRequests,
  passwordResets,
  seedSignupLabels,
  signupVerifications,
  userIdentities,
  userProfiles,
  userStatusEvents,
  users,
} from '../../db/schema'
import { AppError } from '../../lib/errors'
import { newId } from '../../lib/ids'
import type { UserRepository } from '../../repositories/UserRepository'

/** 匿名化済みプロフィール判定（email ドメインで識別） */
export function isAnonymizedProfile(profile: { email: string }): boolean {
  return profile.email.endsWith('@anon.invalid')
}

export function anonymizedEmailFor(userId: string): string {
  return `anon-${userId}@anon.invalid`
}

/** profiles / identities を物理削除。既に無ければ false。 */
export async function purgeUserPii(db: Db, userId: string): Promise<boolean> {
  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.userId, userId),
  })
  if (!profile) return false

  await db.batch([
    db.delete(userIdentities).where(eq(userIdentities.userId, userId)),
    db.delete(userProfiles).where(eq(userProfiles.userId, userId)),
  ])
  return true
}

/**
 * profile 行は残し email/表示名をマスク。identities は削除して再ログイン不可にする。
 * 既に無いか匿名化済みなら false。
 */
export async function anonymizeUserPii(db: Db, userId: string, now = new Date()): Promise<boolean> {
  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.userId, userId),
  })
  if (!profile) return false
  if (isAnonymizedProfile(profile)) return false

  await db.batch([
    db.delete(userIdentities).where(eq(userIdentities.userId, userId)),
    db
      .update(userProfiles)
      .set({
        email: anonymizedEmailFor(userId),
        displayName: '匿名化済み',
        updatedAt: now.toISOString(),
      })
      .where(eq(userProfiles.userId, userId)),
  ])
  return true
}

const PURGE_BATCH_LIMIT = 50

export class PurgeWithdrawnPiiUseCase {
  constructor(private readonly db: Db) {}

  async execute(now = new Date()): Promise<{ purgedUserIds: string[] }> {
    const graceMs = TTL.withdrawGraceDays * 24 * 60 * 60 * 1000
    const cutoff = new Date(now.getTime() - graceMs).toISOString()

    // 最新 withdrawn event が cutoff 以前のユーザー（users 起点 JOIN）
    const candidates = await this.db
      .select({
        userId: users.id,
      })
      .from(users)
      .innerJoin(
        userStatusEvents,
        and(eq(userStatusEvents.userId, users.id), eq(userStatusEvents.type, 'withdrawn')),
      )
      .where(
        and(
          eq(users.status, 'withdrawn'),
          lt(userStatusEvents.createdAt, cutoff),
          sql`${userStatusEvents.seq} = (
            SELECT MAX(e2.seq) FROM user_status_events e2
            WHERE e2.user_id = ${users.id} AND e2.type = 'withdrawn'
          )`,
        ),
      )
      .limit(PURGE_BATCH_LIMIT)

    const purgedUserIds: string[] = []
    for (const row of candidates) {
      if (await purgeUserPii(this.db, row.userId)) {
        purgedUserIds.push(row.userId)
      }
    }

    return { purgedUserIds }
  }
}

function assertBannedOrWithdrawn(status: string, action: string): void {
  if (status !== 'withdrawn' && status !== 'banned') {
    throw new AppError(
      'invalid_status',
      `PII ${action} is only allowed for banned or withdrawn users`,
      400,
    )
  }
}

async function insertAudit(
  db: Db,
  params: { adminUserId: string; action: string; targetUserId: string; createdAt: string },
) {
  await db.insert(adminAuditLogs).values({
    id: newId('audit'),
    adminUserId: params.adminUserId,
    action: params.action,
    targetUserId: params.targetUserId,
    createdAt: params.createdAt,
  })
}

/** 管理画面からの強制実行。banned / withdrawn のみ、猶予を見ない。 */
export class ForcePurgeUserPiiUseCase {
  constructor(
    private readonly db: Db,
    private readonly users: UserRepository,
  ) {}

  async execute(input: { userId: string; adminUserId: string }): Promise<{ purged: true }> {
    const user = await this.users.findById(input.userId)
    if (!user) throw new AppError('not_found', 'User not found', 404)

    assertBannedOrWithdrawn(user.getStatus().raw, 'purge')

    const purged = await purgeUserPii(this.db, input.userId)
    if (!purged) {
      throw new AppError('already_purged', 'PII already deleted', 400)
    }
    await insertAudit(this.db, {
      adminUserId: input.adminUserId,
      action: 'pii_purge',
      targetUserId: input.userId,
      createdAt: new Date().toISOString(),
    })
    return { purged: true }
  }
}

/** 管理画面からの強制匿名化。banned / withdrawn のみ。行は保持してマスク。 */
export class ForceAnonymizeUserPiiUseCase {
  constructor(
    private readonly db: Db,
    private readonly users: UserRepository,
  ) {}

  async execute(input: { userId: string; adminUserId: string }): Promise<{ anonymized: true }> {
    const user = await this.users.findById(input.userId)
    if (!user) throw new AppError('not_found', 'User not found', 404)

    assertBannedOrWithdrawn(user.getStatus().raw, 'anonymize')

    const anonymized = await anonymizeUserPii(this.db, input.userId)
    if (!anonymized) {
      throw new AppError('already_anonymized', 'PII already anonymized or deleted', 400)
    }
    await insertAudit(this.db, {
      adminUserId: input.adminUserId,
      action: 'pii_anonymize',
      targetUserId: input.userId,
      createdAt: new Date().toISOString(),
    })
    return { anonymized: true }
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

    // seed_signup_labels は通常サインアップでも書かれる（名前は seed_* だが FK で紐づく）。
    // signup_verifications を先に消すと FK 違反になるため、同一 batch でラベル → verification の順に削除する。
    const staleSignupIds = (
      await this.db
        .select({ id: signupVerifications.id })
        .from(signupVerifications)
        .where(
          or(isNotNull(signupVerifications.consumedAt), lt(signupVerifications.expiresAt, nowIso)),
        )
    ).map((r) => r.id)

    const signupCount = staleSignupIds.length
    if (staleSignupIds.length > 0) {
      await this.db.batch([
        this.db
          .delete(seedSignupLabels)
          .where(inArray(seedSignupLabels.signupVerificationId, staleSignupIds)),
        this.db.delete(signupVerifications).where(inArray(signupVerifications.id, staleSignupIds)),
      ])
    }

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
      signup: signupCount,
      passwordReset: pwRes.length,
      emailChange: emailRes.length,
    }
  }
}
