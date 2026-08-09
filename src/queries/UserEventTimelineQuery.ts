import { and, asc, eq } from 'drizzle-orm'
import type { Db } from '../db/client'
import { adminUsers, userBans, userStatusEvents, userUnbans, userWithdrawals } from '../db/schema'

export type TimelineEventRow = {
  id: number
  userId: string
  seq: number
  type: string
  actorType: string
  actorId: string | null
  actorName: string | null
  createdAt: string
  withdrawal: {
    reasonCode: string
    reasonText: string | null
    createdAt: string
  } | null
  ban: {
    reasonCode: string
    reasonText: string | null
    createdAt: string
  } | null
  unban: {
    createdAt: string
  } | null
}

/** ユーザー詳細のイベントタイムライン（読み取り専用） */
export class UserEventTimelineQuery {
  constructor(private readonly db: Db) {}

  async listByUserId(userId: string): Promise<TimelineEventRow[]> {
    const rows = await this.db
      .select({
        id: userStatusEvents.id,
        userId: userStatusEvents.userId,
        seq: userStatusEvents.seq,
        type: userStatusEvents.type,
        actorType: userStatusEvents.actorType,
        actorId: userStatusEvents.actorId,
        createdAt: userStatusEvents.createdAt,
        actorEmail: adminUsers.email,
        wReasonCode: userWithdrawals.reasonCode,
        wReasonText: userWithdrawals.reasonText,
        wCreatedAt: userWithdrawals.createdAt,
        bReasonCode: userBans.reasonCode,
        bReasonText: userBans.reasonText,
        bCreatedAt: userBans.createdAt,
        uCreatedAt: userUnbans.createdAt,
      })
      .from(userStatusEvents)
      .leftJoin(
        userWithdrawals,
        and(
          eq(userWithdrawals.userId, userStatusEvents.userId),
          eq(userWithdrawals.seq, userStatusEvents.seq),
        ),
      )
      .leftJoin(
        userBans,
        and(eq(userBans.userId, userStatusEvents.userId), eq(userBans.seq, userStatusEvents.seq)),
      )
      .leftJoin(
        userUnbans,
        and(
          eq(userUnbans.userId, userStatusEvents.userId),
          eq(userUnbans.seq, userStatusEvents.seq),
        ),
      )
      .leftJoin(adminUsers, eq(adminUsers.id, userStatusEvents.actorId))
      .where(eq(userStatusEvents.userId, userId))
      .orderBy(asc(userStatusEvents.seq))

    return rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      seq: r.seq,
      type: r.type,
      actorType: r.actorType,
      actorId: r.actorId,
      actorName: r.actorEmail ?? r.actorId,
      createdAt: r.createdAt,
      withdrawal:
        r.wReasonCode != null && r.wCreatedAt != null
          ? {
              reasonCode: r.wReasonCode,
              reasonText: r.wReasonText,
              createdAt: r.wCreatedAt,
            }
          : null,
      ban:
        r.bReasonCode != null && r.bCreatedAt != null
          ? {
              reasonCode: r.bReasonCode,
              reasonText: r.bReasonText,
              createdAt: r.bCreatedAt,
            }
          : null,
      unban: r.uCreatedAt != null ? { createdAt: r.uCreatedAt } : null,
    }))
  }

  async findLatestBan(userId: string) {
    const timeline = await this.listByUserId(userId)
    for (let i = timeline.length - 1; i >= 0; i--) {
      const e = timeline[i]
      if (e?.type === 'banned' && e.ban) {
        return {
          event: {
            id: e.id,
            userId: e.userId,
            seq: e.seq,
            type: e.type,
            actorType: e.actorType,
            actorId: e.actorId,
            createdAt: e.createdAt,
          },
          ban: e.ban,
        }
      }
    }
    return null
  }
}
