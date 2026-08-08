import { eq, like } from 'drizzle-orm'
import type { Db } from '../db/client'
import { userProfiles } from '../db/schema'

export type UserProfileRow = {
  userId: string
  email: string
  displayName: string
  createdAt: string
  updatedAt: string
}

export class UserProfileRepository {
  constructor(private readonly db: Db) {}

  async findByUserId(userId: string): Promise<UserProfileRow | null> {
    const row = await this.db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, userId),
    })
    return row ?? null
  }

  async findByEmail(email: string): Promise<UserProfileRow | null> {
    const row = await this.db.query.userProfiles.findFirst({
      where: eq(userProfiles.email, email.toLowerCase()),
    })
    return row ?? null
  }

  async searchByEmail(q: string): Promise<UserProfileRow[]> {
    return this.db
      .select()
      .from(userProfiles)
      .where(like(userProfiles.email, `%${q.toLowerCase()}%`))
  }

  async listAll(): Promise<UserProfileRow[]> {
    return this.db.select().from(userProfiles)
  }

  async insert(row: UserProfileRow): Promise<void> {
    await this.db.insert(userProfiles).values(row)
  }

  async update(
    userId: string,
    patch: Partial<Pick<UserProfileRow, 'email' | 'displayName' | 'updatedAt'>>,
  ): Promise<void> {
    await this.db.update(userProfiles).set(patch).where(eq(userProfiles.userId, userId))
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.db.delete(userProfiles).where(eq(userProfiles.userId, userId))
  }
}
