import { and, eq } from 'drizzle-orm'
import type { Db } from '../db/client'
import { userIdentities } from '../db/schema'

export type UserIdentityRow = {
  id: string
  userId: string
  provider: string
  providerUid: string
  passwordHash: string | null
  createdAt: string
}

export class UserIdentityRepository {
  constructor(private readonly db: Db) {}

  async listByUserId(userId: string): Promise<UserIdentityRow[]> {
    return this.db.select().from(userIdentities).where(eq(userIdentities.userId, userId))
  }

  async listAll(): Promise<UserIdentityRow[]> {
    return this.db.select().from(userIdentities)
  }

  async findByProvider(provider: string, providerUid: string): Promise<UserIdentityRow | null> {
    const row = await this.db.query.userIdentities.findFirst({
      where: and(
        eq(userIdentities.provider, provider),
        eq(userIdentities.providerUid, providerUid),
      ),
    })
    return row ?? null
  }

  async findPasswordIdentity(userId: string): Promise<UserIdentityRow | null> {
    const row = await this.db.query.userIdentities.findFirst({
      where: and(eq(userIdentities.userId, userId), eq(userIdentities.provider, 'password')),
    })
    return row ?? null
  }

  async insert(row: UserIdentityRow): Promise<void> {
    await this.db.insert(userIdentities).values(row)
  }

  async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.buildUpdatePasswordHashStatement(id, passwordHash)
  }

  /** db.batch 用。await せずに渡す */
  buildUpdatePasswordHashStatement(id: string, passwordHash: string) {
    return this.db.update(userIdentities).set({ passwordHash }).where(eq(userIdentities.id, id))
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.db.delete(userIdentities).where(eq(userIdentities.userId, userId))
  }
}
