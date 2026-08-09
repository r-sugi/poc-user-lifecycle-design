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
    createdAt: string
  }
  withdrawal?: {
    reasonCode: string
    reasonText?: string | null
    createdAt: string
  }
  ban?: {
    adminUserId: string
    reasonCode: string
    reasonText?: string | null
    createdAt: string
  }
  unban?: {
    adminUserId: string
    createdAt: string
  }
}

/**
 * 方針 B: 単発 events INSERT（UNIQUE で CAS）→ 成功時のみ batch([詳細, users UPDATE])
 * 失敗時のズレは「履歴あり・キャッシュ古い」方向（設計書 §7.2）
 */
export class StatusTransitionWriter {
  constructor(private readonly db: Db) {}

  async apply(params: StatusTransitionParams): Promise<void> {
    const phase = await this.insertEventCas(params)
    if (phase === 'done') return

    const event = await this.db.query.userStatusEvents.findFirst({
      where: and(
        eq(userStatusEvents.userId, params.userId),
        eq(userStatusEvents.seq, params.nextSeq),
      ),
    })
    if (!event) throw new AppError('internal_error', 'Failed to write status event', 500)

    const statements: BatchItem<'sqlite'>[] = []

    if (params.withdrawal) {
      const existing = await this.db.query.userWithdrawals.findFirst({
        where: eq(userWithdrawals.eventId, event.id),
      })
      if (!existing) {
        statements.push(
          this.db.insert(userWithdrawals).values({
            eventId: event.id,
            reasonCode: params.withdrawal.reasonCode,
            reasonText: params.withdrawal.reasonText ?? null,
            createdAt: params.withdrawal.createdAt,
          }),
        )
      }
    }
    if (params.ban) {
      const existing = await this.db.query.userBans.findFirst({
        where: eq(userBans.eventId, event.id),
      })
      if (!existing) {
        statements.push(
          this.db.insert(userBans).values({
            eventId: event.id,
            adminUserId: params.ban.adminUserId,
            reasonCode: params.ban.reasonCode,
            reasonText: params.ban.reasonText ?? null,
            createdAt: params.ban.createdAt,
          }),
        )
      }
    }
    if (params.unban) {
      const existing = await this.db.query.userUnbans.findFirst({
        where: eq(userUnbans.eventId, event.id),
      })
      if (!existing) {
        statements.push(
          this.db.insert(userUnbans).values({
            eventId: event.id,
            adminUserId: params.unban.adminUserId,
            createdAt: params.unban.createdAt,
          }),
        )
      }
    }

    statements.push(
      this.db
        .update(users)
        .set({
          status: params.nextStatus,
          lastSeq: params.nextSeq,
          updatedAt: params.updatedAt,
        })
        .where(and(eq(users.id, params.userId), eq(users.lastSeq, params.expectedSeq)))
        .returning({ id: users.id }),
    )

    const first = statements[0]
    if (!first) throw new AppError('internal_error', 'Empty status transition batch', 500)

    const results = await this.db.batch([first, ...statements.slice(1)])
    const updateResult = results[results.length - 1] as { id: string }[]
    if (!Array.isArray(updateResult) || updateResult.length === 0) {
      const current = await this.db.query.users.findFirst({ where: eq(users.id, params.userId) })
      if (current?.lastSeq === params.nextSeq && current.status === params.nextStatus) {
        return
      }
      throw new AppError(
        'optimistic_lock_conflict',
        'Status update conflict (event written, cache stale)',
        409,
      )
    }
  }

  /** @returns done = 既に完了 / continue = batch へ進む */
  private async insertEventCas(params: StatusTransitionParams): Promise<'done' | 'continue'> {
    try {
      await this.db.insert(userStatusEvents).values({
        userId: params.userId,
        seq: params.nextSeq,
        type: params.event.type,
        actorType: params.event.actorType,
        createdAt: params.event.createdAt,
      })
      return 'continue'
    } catch (e) {
      if (!isUniqueViolation(e)) throw e
    }

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
    if (current?.lastSeq === params.nextSeq && current.status === params.nextStatus) {
      return 'done'
    }
    if (current?.lastSeq === params.expectedSeq && existing.type === params.event.type) {
      return 'continue'
    }
    throw new AppError('optimistic_lock_conflict', 'Status update conflict', 409)
  }
}

function isUniqueViolation(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false
  const msg = 'message' in e && typeof e.message === 'string' ? e.message : String(e)
  return /UNIQUE|unique|constraint/i.test(msg)
}
