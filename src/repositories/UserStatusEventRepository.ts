import { and, asc, desc, eq } from 'drizzle-orm'
import type { Db } from '../db/client'
import { userBans, userStatusEvents } from '../db/schema'

export type StatusEventRow = {
  id: number
  userId: string
  seq: number
  type: string
  actorType: string
  actorId: string | null
  createdAt: string
}

export class UserStatusEventRepository {
  constructor(private readonly db: Db) {}

  async listByUserId(userId: string): Promise<StatusEventRow[]> {
    return this.db
      .select()
      .from(userStatusEvents)
      .where(eq(userStatusEvents.userId, userId))
      .orderBy(asc(userStatusEvents.seq))
  }

  async listAll(): Promise<StatusEventRow[]> {
    return this.db
      .select()
      .from(userStatusEvents)
      .orderBy(asc(userStatusEvents.userId), asc(userStatusEvents.seq))
  }

  async findLatestOfType(userId: string, type: string): Promise<StatusEventRow | null> {
    const rows = await this.db
      .select()
      .from(userStatusEvents)
      .where(and(eq(userStatusEvents.userId, userId), eq(userStatusEvents.type, type)))
      .orderBy(desc(userStatusEvents.seq))
      .limit(1)
    return rows[0] ?? null
  }
}

export class UserBanRepository {
  constructor(private readonly db: Db) {}

  async findLatestForUser(userId: string) {
    const rows = await this.db
      .select()
      .from(userBans)
      .where(eq(userBans.userId, userId))
      .orderBy(desc(userBans.seq))
      .limit(1)
    const ban = rows[0]
    if (!ban) return null
    const event = await this.db.query.userStatusEvents.findFirst({
      where: and(eq(userStatusEvents.userId, ban.userId), eq(userStatusEvents.seq, ban.seq)),
    })
    if (!event) return null
    return { event, ban }
  }

  /** 全 banned 詳細。userId でマップ合成する前提 */
  async listAllWithEvents() {
    return this.db
      .select({
        userId: userBans.userId,
        seq: userBans.seq,
        reasonCode: userBans.reasonCode,
        reasonText: userBans.reasonText,
        createdAt: userBans.createdAt,
        actorId: userStatusEvents.actorId,
        type: userStatusEvents.type,
      })
      .from(userBans)
      .innerJoin(
        userStatusEvents,
        and(eq(userBans.userId, userStatusEvents.userId), eq(userBans.seq, userStatusEvents.seq)),
      )
  }
}
