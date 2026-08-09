import { assertUserActive } from '../../lib/assertUserActive'
import { AppError } from '../../lib/errors'
import type { EmailChangeRequestRepository } from '../../repositories/EmailChangeRequestRepository'
import type { PasswordResetRepository } from '../../repositories/PasswordResetRepository'
import type { UserIdentityRepository } from '../../repositories/UserIdentityRepository'
import type { UserProfileRepository } from '../../repositories/UserProfileRepository'
import type { UserRepository } from '../../repositories/UserRepository'
import type { UserStatusEventRepository } from '../../repositories/UserStatusEventRepository'
import type { SessionService } from '../../services/SessionService'

export class GetMeUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly profiles: UserProfileRepository,
    private readonly identities: UserIdentityRepository,
    private readonly events: UserStatusEventRepository,
    private readonly sessions: SessionService,
    private readonly emailChanges: EmailChangeRequestRepository,
    private readonly passwordResets: PasswordResetRepository,
  ) {}

  async execute(userId: string) {
    const user = await this.users.findById(userId)
    if (!user) throw new AppError('not_found', 'User not found', 404)
    assertUserActive(user)
    const status = user.getStatus().raw
    const profile = await this.profiles.findByUserId(userId)
    const identities = await this.identities.listByUserId(userId)
    const events = await this.events.listByUserId(userId)
    const sessions = await this.sessions.listUserSessions(userId)
    return {
      id: userId,
      status,
      lastSeq: user.getLastSeq(),
      profile,
      identities: identities.map((i) => ({
        provider: i.provider,
        providerUid: i.providerUid,
      })),
      events,
      sessions: sessions.map((s) => s.payload),
      pendingEmailChange: await this.emailChanges.hasPending(userId),
      pendingPasswordReset: await this.passwordResets.hasPending(userId),
    }
  }
}

export class UpdateProfileUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly profiles: UserProfileRepository,
  ) {}

  async execute(input: { userId: string; displayName: string }) {
    const user = await this.users.findById(input.userId)
    if (!user) throw new AppError('not_found', 'User not found', 404)
    assertUserActive(user)
    const profile = await this.profiles.findByUserId(input.userId)
    if (!profile) throw new AppError('not_found', 'Profile missing', 404)
    await this.profiles.update(input.userId, {
      displayName: input.displayName,
      updatedAt: new Date().toISOString(),
    })
    return { ok: true as const }
  }
}
