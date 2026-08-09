import { eq } from 'drizzle-orm'
import type { Db } from '../db/client'
import { adminUsers } from '../db/schema'
import { AdminUser } from '../domain/admin/AdminUser'

export class AdminUserRepository {
  constructor(private readonly db: Db) {}

  async findByEmail(email: string): Promise<AdminUser | null> {
    const row = await this.db.query.adminUsers.findFirst({
      where: eq(adminUsers.email, email.toLowerCase()),
    })
    if (!row) return null
    return AdminUser.restore({
      id: row.id,
      email: row.email,
      passwordHash: row.passwordHash,
      createdAt: row.createdAt,
      disabledAt: row.disabledAt,
    })
  }

  async findById(id: string): Promise<AdminUser | null> {
    const row = await this.db.query.adminUsers.findFirst({
      where: eq(adminUsers.id, id),
    })
    if (!row) return null
    return AdminUser.restore({
      id: row.id,
      email: row.email,
      passwordHash: row.passwordHash,
      createdAt: row.createdAt,
      disabledAt: row.disabledAt,
    })
  }

  async listAll(): Promise<AdminUser[]> {
    const rows = await this.db.query.adminUsers.findMany({
      orderBy: (t, { asc }) => [asc(t.email)],
    })
    return rows.map((row) =>
      AdminUser.restore({
        id: row.id,
        email: row.email,
        passwordHash: row.passwordHash,
        createdAt: row.createdAt,
        disabledAt: row.disabledAt,
      }),
    )
  }

  async insert(params: {
    id: string
    email: string
    passwordHash: string
    createdAt: string
    disabledAt?: string | null
  }): Promise<void> {
    await this.db.insert(adminUsers).values({
      id: params.id,
      email: params.email,
      passwordHash: params.passwordHash,
      createdAt: params.createdAt,
      disabledAt: params.disabledAt ?? null,
    })
  }

  async setDisabledAt(id: string, disabledAt: string | null): Promise<void> {
    await this.db.update(adminUsers).set({ disabledAt }).where(eq(adminUsers.id, id))
  }
}
