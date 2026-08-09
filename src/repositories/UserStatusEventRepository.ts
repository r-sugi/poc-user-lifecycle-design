import { asc, desc, eq } from 'drizzle-orm'
import type { Db } from '../db/client'
import { userBans, userStatusEvents, userUnbans, userWithdrawals } from '../db/schema'

export type StatusEventRow = {
  id: number
  userId: string
  seq: number
  type: string
  actorType: string
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
    return this.db.select().from(userStatusEvents).orderBy(asc(userStatusEvents.userId), asc(userStatusEvents.seq))
  }

  async findLatestOfType(userId: string, type: string): Promise<StatusEventRow | null> {
    const rows = await this.db
      .select()
      .from(userStatusEvents)
      .where(eq(userStatusEvents.userId, userId))
      .orderBy(desc(userStatusEvents.seq))
    return rows.find((r) => r.type === type) ?? null
  }
}

export class UserWithdrawalRepository {
  constructor(private readonly db: Db) {}

  async findByEventId(eventId: number) {
    return (
      (await this.db.query.userWithdrawals.findFirst({
        where: eq(userWithdrawals.eventId, eventId),
      })) ?? null
    )
  }
}

export class UserBanRepository {
  constructor(private readonly db: Db) {}

  async findByEventId(eventId: number) {
    return (
      (await this.db.query.userBans.findFirst({
        where: eq(userBans.eventId, eventId),
      })) ?? null
    )
  }

  async findLatestForUser(userId: string) {
    const events = await this.db
      .select()
      .from(userStatusEvents)
      .where(eq(userStatusEvents.userId, userId))
      .orderBy(desc(userStatusEvents.seq))
    for (const ev of events) {
      if (ev.type !== 'banned') continue
      const ban = await this.findByEventId(ev.id)
      if (ban) return { event: ev, ban }
    }
    return null
  }

  /** 全 banned 詳細。event.userId でマップ合成する前提 */
  async listAllWithEvents() {
    const rows = await this.db
      .select({
        eventId: userBans.eventId,
        adminUserId: userBans.adminUserId,
        reasonCode: userBans.reasonCode,
        reasonText: userBans.reasonText,
        createdAt: userBans.createdAt,
        userId: userStatusEvents.userId,
        seq: userStatusEvents.seq,
        type: userStatusEvents.type,
      })
      .from(userBans)
      .innerJoin(userStatusEvents, eq(userBans.eventId, userStatusEvents.id))
    return rows
  }
}

export class UserUnbanRepository {
  constructor(private readonly db: Db) {}

  async findByEventId(eventId: number) {
    return (
      (await this.db.query.userUnbans.findFirst({
        where: eq(userUnbans.eventId, eventId),
      })) ?? null
    )
  }
}
