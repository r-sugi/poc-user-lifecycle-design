import { and, eq, isNull } from 'drizzle-orm'
import type { Db } from '../db/client'
import { passwordResets } from '../db/schema'

export type PasswordResetRow = {
  id: string
  userId: string
  tokenHash: string
  expiresAt: string
  consumedAt: string | null
  createdAt: string
  /** POC 検証トップ用。無い場合は null */
  rawToken: string | null
}

export class PasswordResetRepository {
  constructor(private readonly db: Db) {}

  async insert(row: PasswordResetRow): Promise<void> {
    await this.db.insert(passwordResets).values(row)
  }

  async findByTokenHash(tokenHash: string): Promise<PasswordResetRow | null> {
    const row = await this.db.query.passwordResets.findFirst({
      where: eq(passwordResets.tokenHash, tokenHash),
    })
    return row ?? null
  }

  async hasPending(userId: string): Promise<boolean> {
    const rows = await this.db
      .select()
      .from(passwordResets)
      .where(and(eq(passwordResets.userId, userId), isNull(passwordResets.consumedAt)))
    const now = Date.now()
    return rows.some((r) => new Date(r.expiresAt).getTime() > now)
  }

  async listAll(): Promise<PasswordResetRow[]> {
    return this.db.select().from(passwordResets)
  }

  /** 未消費・期限内の最新行の raw_token（POC）。無ければ null */
  async findLatestPendingRawToken(userId: string): Promise<string | null> {
    const rows = await this.db
      .select()
      .from(passwordResets)
      .where(and(eq(passwordResets.userId, userId), isNull(passwordResets.consumedAt)))
    const now = Date.now()
    const valid = rows
      .filter((r) => new Date(r.expiresAt).getTime() > now && !!r.rawToken)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return valid[0]?.rawToken ?? null
  }

  async markConsumed(id: string, consumedAt: string): Promise<void> {
    await this.db.update(passwordResets).set({ consumedAt }).where(eq(passwordResets.id, id))
  }
}
