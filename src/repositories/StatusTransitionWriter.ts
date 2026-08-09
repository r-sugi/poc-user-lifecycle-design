import { and, eq } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'
import type { Db } from '../db/client'
import { userBans, userStatusEvents, userUnbans, userWithdrawals, users } from '../db/schema'
import { AppError } from '../lib/errors'

export type StatusTransitionParams = {
  userId: string
  expectedSeq: number
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
 * UNIQUE 違反は例外 → batch 全体ロールバック。
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
      await this.resolveUniqueConflict(params)
    }
  }

  /** 並行リトライ: 同一イベントが既にあれば成功扱い、異なる遷移なら 409 */
  private async resolveUniqueConflict(params: StatusTransitionParams): Promise<void> {
    const existing = await this.db.query.userStatusEvents.findFirst({
      where: and(
        eq(userStatusEvents.userId, params.userId),
        eq(userStatusEvents.seq, params.nextSeq),
      ),
    })
    if (!existing) {
      throw new AppError('optimistic_lock_conflict', 'Status update conflict', 409)
    }
    const current = await this.db.query.users.findFirst({ where: eq(users.id, params.userId) })
    if (
      existing.type === params.event.type &&
      current?.lastSeq === params.nextSeq &&
      current.status === params.nextStatus
    ) {
      return
    }
    throw new AppError('optimistic_lock_conflict', 'Status update conflict', 409)
  }
}

function isUniqueViolation(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false
  const msg = 'message' in e && typeof e.message === 'string' ? e.message : String(e)
  return /UNIQUE|unique|constraint/i.test(msg)
}
