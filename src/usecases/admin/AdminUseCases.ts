import type { Context } from 'hono'
import { Email } from '../../domain/shared/Email'
import { ReasonCode } from '../../domain/shared/ReasonCode'
import { AppError } from '../../lib/errors'
import type { UserEventTimelineQuery } from '../../queries/UserEventTimelineQuery'
import type { AdminUserRepository } from '../../repositories/AdminUserRepository'
import type { EmailChangeRequestRepository } from '../../repositories/EmailChangeRequestRepository'
import type { PasswordResetRepository } from '../../repositories/PasswordResetRepository'
import type { UserIdentityRepository } from '../../repositories/UserIdentityRepository'
import type { UserProfileRepository } from '../../repositories/UserProfileRepository'
import type { UserRepository } from '../../repositories/UserRepository'
import type { PasswordHashingService } from '../../services/PasswordHashingService'
import type { SessionService } from '../../services/SessionService'
import type { UserStatusTransitionService } from '../../services/UserStatusTransitionService'

export class AdminLoginUseCase {
  constructor(
    private readonly admins: AdminUserRepository,
    private readonly hashing: PasswordHashingService,
    private readonly sessions: SessionService,
  ) {}

  async execute(
    input: { email: string; password: string; userAgent?: string; ipAddress?: string },
    c?: Context,
  ) {
    const email = Email.create(input.email).toString()
    const admin = await this.admins.findByEmail(email)
    if (!admin) throw new AppError('invalid_credentials', 'Invalid credentials', 401)
    if (admin.isDisabled) throw new AppError('admin_disabled', 'Admin account disabled', 403)
    const ok = await this.hashing.verify(input.password, admin.passwordHash)
    if (!ok) throw new AppError('invalid_credentials', 'Invalid credentials', 401)
    await this.sessions.issueAdminSession(
      admin.id,
      {
        userAgent: input.userAgent ?? '',
        ipAddress: input.ipAddress ?? '',
      },
      c,
    )
    return { adminId: admin.id }
  }
}

export type UserSearchRow = {
  userId: string
  status: string
  email: string | null
  displayName: string | null
  profileMissing: boolean
}

export class SearchUsersUseCase {
  constructor(private readonly users: UserRepository) {}

  async execute(emailQuery?: string): Promise<UserSearchRow[]> {
    return this.users.searchWithProfiles(emailQuery?.trim() || undefined)
  }
}

export class GetUserDetailUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly profiles: UserProfileRepository,
    private readonly identities: UserIdentityRepository,
    private readonly timeline: UserEventTimelineQuery,
    private readonly sessions: SessionService,
    private readonly emailChanges: EmailChangeRequestRepository,
    private readonly passwordResets: PasswordResetRepository,
  ) {}

  async execute(userId: string) {
    const user = await this.users.findById(userId)
    if (!user) throw new AppError('not_found', 'User not found', 404)
    const profile = await this.profiles.findByUserId(userId)
    const identities = await this.identities.listByUserId(userId)
    const events = await this.timeline.listByUserId(userId)
    const sessions = await this.sessions.listUserSessions(userId)
    const ban = await this.timeline.findLatestBan(userId)
    return {
      user: {
        id: userId,
        status: user.getStatus().raw,
        lastSeq: user.getLastSeq(),
        verifiedAt: user.verifiedAt,
      },
      profile,
      identities,
      events,
      sessions: sessions.map((s) => ({ key: s.key, ...s.payload })),
      latestBan: ban
        ? {
            event: ban.event,
            ban: {
              ...ban.ban,
              adminUserId: ban.event.actorId,
            },
          }
        : null,
      pendingEmailChange: await this.emailChanges.hasPending(userId),
      pendingPasswordReset: await this.passwordResets.hasPending(userId),
    }
  }
}

export class BanUserUseCase {
  constructor(private readonly transitions: UserStatusTransitionService) {}

  async execute(input: {
    userId: string
    adminUserId: string
    reasonCode: string
    reasonText?: string
  }) {
    const code = ReasonCode.ban(input.reasonCode)
    await this.transitions.ban({
      userId: input.userId,
      adminUserId: input.adminUserId,
      reasonCode: code.value,
      reasonText: input.reasonText,
    })
    return { ok: true as const }
  }
}

export class UnbanUserUseCase {
  constructor(private readonly transitions: UserStatusTransitionService) {}

  async execute(input: { userId: string; adminUserId: string }) {
    await this.transitions.unban({
      userId: input.userId,
      adminUserId: input.adminUserId,
    })
    return { ok: true as const }
  }
}
