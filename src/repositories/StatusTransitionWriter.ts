import { and, eq } from 'drizzle-orm'
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
 * 方針 B: 単発楽観ロック UPDATE → 成功時のみ event / 詳細を書く（設計書 §7.2）
 */
export class StatusTransitionWriter {
  constructor(private readonly db: Db) {}

  async apply(params: StatusTransitionParams): Promise<void> {
    const result = await this.db
      .update(users)
      .set({
        status: params.nextStatus,
        lastSeq: params.nextSeq,
        updatedAt: params.updatedAt,
      })
      .where(and(eq(users.id, params.userId), eq(users.lastSeq, params.expectedSeq)))
      .returning({ id: users.id })

    if (result.length === 0) {
      const current = await this.db.query.users.findFirst({ where: eq(users.id, params.userId) })
      if (!current || current.lastSeq !== params.nextSeq) {
        throw new AppError('optimistic_lock_conflict', 'Status update conflict', 409)
      }
    }

    await this.db.insert(userStatusEvents).values({
      userId: params.userId,
      seq: params.nextSeq,
      type: params.event.type,
      actorType: params.event.actorType,
      createdAt: params.event.createdAt,
    })

    const event = await this.db.query.userStatusEvents.findFirst({
      where: and(
        eq(userStatusEvents.userId, params.userId),
        eq(userStatusEvents.seq, params.nextSeq),
      ),
    })
    if (!event) throw new AppError('internal_error', 'Failed to write status event', 500)

    if (params.withdrawal) {
      await this.db.insert(userWithdrawals).values({
        eventId: event.id,
        reasonCode: params.withdrawal.reasonCode,
        reasonText: params.withdrawal.reasonText ?? null,
        createdAt: params.withdrawal.createdAt,
      })
    }
    if (params.ban) {
      await this.db.insert(userBans).values({
        eventId: event.id,
        adminUserId: params.ban.adminUserId,
        reasonCode: params.ban.reasonCode,
        reasonText: params.ban.reasonText ?? null,
        createdAt: params.ban.createdAt,
      })
    }
    if (params.unban) {
      await this.db.insert(userUnbans).values({
        eventId: event.id,
        adminUserId: params.unban.adminUserId,
        createdAt: params.unban.createdAt,
      })
    }
  }
}
