import { and, eq, isNull } from 'drizzle-orm'
import type { Db } from '../db/client'
import { signupVerifications } from '../db/schema'

export type SignupVerificationRow = {
  id: string
  email: string
  passwordHash: string
  tokenHash: string
  expiresAt: string
  consumedAt: string | null
  createdAt: string
}

export class SignupVerificationRepository {
  constructor(private readonly db: Db) {}

  async insert(row: SignupVerificationRow): Promise<void> {
    await this.db.insert(signupVerifications).values(row)
  }

  async findByTokenHash(tokenHash: string): Promise<SignupVerificationRow | null> {
    const row = await this.db.query.signupVerifications.findFirst({
      where: eq(signupVerifications.tokenHash, tokenHash),
    })
    return row ?? null
  }

  async findById(id: string): Promise<SignupVerificationRow | null> {
    const row = await this.db.query.signupVerifications.findFirst({
      where: eq(signupVerifications.id, id),
    })
    return row ?? null
  }

  async listByEmail(email: string): Promise<SignupVerificationRow[]> {
    return this.db
      .select()
      .from(signupVerifications)
      .where(eq(signupVerifications.email, email.toLowerCase()))
  }

  async listAll(): Promise<SignupVerificationRow[]> {
    return this.db.select().from(signupVerifications)
  }

  async markConsumed(id: string, consumedAt: string): Promise<void> {
    await this.db
      .update(signupVerifications)
      .set({ consumedAt })
      .where(eq(signupVerifications.id, id))
  }

  async consumeActiveByEmail(email: string, consumedAt: string): Promise<void> {
    await this.db
      .update(signupVerifications)
      .set({ consumedAt })
      .where(and(eq(signupVerifications.email, email.toLowerCase()), isNull(signupVerifications.consumedAt)))
  }
}
