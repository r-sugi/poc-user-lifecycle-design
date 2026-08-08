import { eq } from 'drizzle-orm'
import type { Db } from '../db/client'
import { seedSignupLabels, seedUserLabels } from '../db/schema'

export class SeedUserLabelRepository {
  constructor(private readonly db: Db) {}

  async findByUserId(userId: string): Promise<string | null> {
    const row = await this.db.query.seedUserLabels.findFirst({
      where: eq(seedUserLabels.userId, userId),
    })
    return row?.initialStateLabel ?? null
  }

  async insert(userId: string, initialStateLabel: string, createdAt: string): Promise<void> {
    await this.db.insert(seedUserLabels).values({ userId, initialStateLabel, createdAt })
  }
}

export type SeedSignupLabelRow = {
  initialStateLabel: string
  rawToken: string | null
  displayName: string | null
}

export class SeedSignupLabelRepository {
  constructor(private readonly db: Db) {}

  async findBySignupId(signupVerificationId: string): Promise<SeedSignupLabelRow | null> {
    const row = await this.db.query.seedSignupLabels.findFirst({
      where: eq(seedSignupLabels.signupVerificationId, signupVerificationId),
    })
    if (!row) return null
    return {
      initialStateLabel: row.initialStateLabel,
      rawToken: row.rawToken ?? null,
      displayName: row.displayName ?? null,
    }
  }

  async insert(params: {
    signupVerificationId: string
    initialStateLabel: string
    rawToken?: string | null
    displayName?: string | null
    createdAt: string
  }): Promise<void> {
    await this.db.insert(seedSignupLabels).values({
      signupVerificationId: params.signupVerificationId,
      initialStateLabel: params.initialStateLabel,
      rawToken: params.rawToken ?? null,
      displayName: params.displayName ?? null,
      createdAt: params.createdAt,
    })
  }
}
