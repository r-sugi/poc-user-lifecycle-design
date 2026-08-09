import { and, eq } from 'drizzle-orm'
import type { Db } from '../db/client'
import { userProfiles, users } from '../db/schema'
import { User } from '../domain/user/User'
import { AppError } from '../lib/errors'
import { StatusTransitionWriter, type StatusTransitionParams } from './StatusTransitionWriter'

export class UserRepository {
  private readonly transitions: StatusTransitionWriter

  constructor(private readonly db: Db) {
    this.transitions = new StatusTransitionWriter(db)
  }

  getDb(): Db {
    return this.db
  }

  async findById(id: string): Promise<User | null> {
    const row = await this.db.query.users.findFirst({ where: eq(users.id, id) })
    if (!row) return null
    return User.restore({
      id: row.id,
      status: row.status,
      lastSeq: row.lastSeq,
      verifiedAt: row.verifiedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })
  }

  async listAll(): Promise<User[]> {
    const rows = await this.db.select().from(users)
    return rows.map((row) =>
      User.restore({
        id: row.id,
        status: row.status,
        lastSeq: row.lastSeq,
        verifiedAt: row.verifiedAt,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }),
    )
  }

  /** users 起点 LEFT JOIN profiles（PII purge 後も一覧に残す） */
  async searchWithProfiles(emailQuery?: string) {
    const rows = await this.db
      .select({
        userId: users.id,
        status: users.status,
        email: userProfiles.email,
        displayName: userProfiles.displayName,
      })
      .from(users)
      .leftJoin(userProfiles, eq(userProfiles.userId, users.id))

    const mapped = rows.map((r) => ({
      userId: r.userId,
      status: r.status,
      email: r.email ?? null,
      displayName: r.displayName ?? null,
      profileMissing: r.email == null,
    }))

    if (!emailQuery) return mapped
    const q = emailQuery.toLowerCase()
    return mapped.filter((r) => r.email?.toLowerCase().includes(q))
  }

  async insert(params: {
    id: string
    status: string
    lastSeq: number
    verifiedAt: string
    createdAt: string
    updatedAt: string
  }): Promise<void> {
    await this.db.insert(users).values(params)
  }

  /** 方針 B の原子的ステータス遷移（詳細は StatusTransitionWriter） */
  async applyStatusTransition(params: StatusTransitionParams): Promise<void> {
    await this.transitions.apply(params)
  }

  async updateStatusOptimistic(params: {
    id: string
    expectedSeq: number
    nextStatus: string
    nextSeq: number
    updatedAt: string
  }): Promise<boolean> {
    const result = await this.db
      .update(users)
      .set({
        status: params.nextStatus,
        lastSeq: params.nextSeq,
        updatedAt: params.updatedAt,
      })
      .where(and(eq(users.id, params.id), eq(users.lastSeq, params.expectedSeq)))
      .returning({ id: users.id })

    if (result.length > 0) return true
    const current = await this.findById(params.id)
    if (!current || current.getLastSeq() !== params.nextSeq) {
      throw new AppError('optimistic_lock_conflict', 'Status update conflict', 409)
    }
    return true
  }
}
