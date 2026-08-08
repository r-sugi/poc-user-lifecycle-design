import { and, eq, isNull } from 'drizzle-orm'
import type { Db } from '../db/client'
import { emailChangeRequests } from '../db/schema'

export type EmailChangeRequestRow = {
  id: string
  userId: string
  newEmail: string
  tokenHash: string
  expiresAt: string
  consumedAt: string | null
  createdAt: string
}

export class EmailChangeRequestRepository {
  constructor(private readonly db: Db) {}

  async insert(row: EmailChangeRequestRow): Promise<void> {
    await this.db.insert(emailChangeRequests).values(row)
  }

  async findByTokenHash(tokenHash: string): Promise<EmailChangeRequestRow | null> {
    const row = await this.db.query.emailChangeRequests.findFirst({
      where: eq(emailChangeRequests.tokenHash, tokenHash),
    })
    return row ?? null
  }

  async hasPending(userId: string): Promise<boolean> {
    const rows = await this.db
      .select()
      .from(emailChangeRequests)
      .where(and(eq(emailChangeRequests.userId, userId), isNull(emailChangeRequests.consumedAt)))
    const now = Date.now()
    return rows.some((r) => new Date(r.expiresAt).getTime() > now)
  }

  async markConsumed(id: string, consumedAt: string): Promise<void> {
    await this.db
      .update(emailChangeRequests)
      .set({ consumedAt })
      .where(eq(emailChangeRequests.id, id))
  }
}
