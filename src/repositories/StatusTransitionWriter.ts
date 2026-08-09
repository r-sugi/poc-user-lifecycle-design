import { eq } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'
import type { Db } from '../db/client'
import { userBans, userStatusEvents, users, userUnbans, userWithdrawals } from '../db/schema'
import { isUniqueViolation } from '../lib/dbErrors'
import { AppError } from '../lib/errors'

export type StatusTransitionParams = {
  userId: string
  nextStatus: string
  nextSeq: number
  updatedAt: string
  event: {
    type: string
    actorType: string
    actorId?: string | null
    createdAt: string
  }
  withdrawal?: {
    reasonCode: string
    reasonText?: string | null
    createdAt: string
  }
  ban?: {
    reasonCode: string
    reasonText?: string | null
    createdAt: string
  }
  unban?: {
    createdAt: string
  }
}

/**
 * event INSERT（UNIQUE(user_id,seq) が CAS）+ 詳細 INSERT + users UPDATE を同一 batch。
 * UNIQUE 違反は例外 → batch 全体ロールバック → 409（後勝ちさせない）。
 */
export class StatusTransitionWriter {
  constructor(private readonly db: Db) {}

  async apply(params: StatusTransitionParams): Promise<void> {
    const statements: BatchItem<'sqlite'>[] = [
      this.db.insert(userStatusEvents).values({
        userId: params.userId,
        seq: params.nextSeq,
        type: params.event.type,
        actorType: params.event.actorType,
        actorId: params.event.actorId ?? null,
        createdAt: params.event.createdAt,
      }),
    ]

    if (params.withdrawal) {
      statements.push(
        this.db.insert(userWithdrawals).values({
          userId: params.userId,
          seq: params.nextSeq,
          reasonCode: params.withdrawal.reasonCode,
          reasonText: params.withdrawal.reasonText ?? null,
          createdAt: params.withdrawal.createdAt,
        }),
      )
    }
    if (params.ban) {
      statements.push(
        this.db.insert(userBans).values({
          userId: params.userId,
          seq: params.nextSeq,
          reasonCode: params.ban.reasonCode,
          reasonText: params.ban.reasonText ?? null,
          createdAt: params.ban.createdAt,
        }),
      )
    }
    if (params.unban) {
      statements.push(
        this.db.insert(userUnbans).values({
          userId: params.userId,
          seq: params.nextSeq,
          createdAt: params.unban.createdAt,
        }),
      )
    }

    statements.push(
      this.db
        .update(users)
        .set({
          status: params.nextStatus,
          lastSeq: params.nextSeq,
          updatedAt: params.updatedAt,
        })
        .where(eq(users.id, params.userId)),
    )

    const first = statements[0]
    if (!first) throw new AppError('internal_error', 'Empty status transition batch', 500)

    try {
      await this.db.batch([first, ...statements.slice(1)])
    } catch (e) {
      if (!isUniqueViolation(e)) throw e
      throw new AppError('optimistic_lock_conflict', 'Status update conflict', 409)
    }
  }
}
