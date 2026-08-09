import type { Context } from 'hono'
import { Email } from '../../domain/shared/Email'
import { ReasonCode } from '../../domain/shared/ReasonCode'
import { AppError } from '../../lib/errors'
import type { AdminUserRepository } from '../../repositories/AdminUserRepository'
import type { EmailChangeRequestRepository } from '../../repositories/EmailChangeRequestRepository'
import type { PasswordResetRepository } from '../../repositories/PasswordResetRepository'
import type { UserBanRepository, UserUnbanRepository } from '../../repositories/UserBanRepository'
import type { UserIdentityRepository } from '../../repositories/UserIdentityRepository'
import type { UserProfileRepository } from '../../repositories/UserProfileRepository'
import type { UserRepository } from '../../repositories/UserRepository'
import type { UserStatusEventRepository } from '../../repositories/UserStatusEventRepository'
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

export class SearchUsersUseCase {
  constructor(private readonly profiles: UserProfileRepository) {}

  async execute(emailQuery?: string) {
    if (emailQuery && emailQuery.trim()) {
      return this.profiles.searchByEmail(emailQuery.trim())
    }
    return this.profiles.listAll()
  }
}

export class GetUserDetailUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly profiles: UserProfileRepository,
    private readonly identities: UserIdentityRepository,
    private readonly events: UserStatusEventRepository,
    private readonly bans: UserBanRepository,
    private readonly unbans: UserUnbanRepository,
    private readonly admins: AdminUserRepository,
    private readonly sessions: SessionService,
    private readonly emailChanges: EmailChangeRequestRepository,
    private readonly passwordResets: PasswordResetRepository,
  ) {}

  async execute(userId: string) {
    const user = await this.users.findById(userId)
    if (!user) throw new AppError('not_found', 'User not found', 404)
    const profile = await this.profiles.findByUserId(userId)
    const identities = await this.identities.listByUserId(userId)
    const events = await this.events.listByUserId(userId)
    const sessions = await this.sessions.listUserSessions(userId)
    const ban = await this.bans.findLatestForUser(userId)
    const adminEmailById = new Map<string, string>()
    const eventsWithActor = []
    for (const e of events) {
      let actorName: string | null = null
      if (e.actorType === 'admin') {
        const adminId = await this.resolveAdminActorId(e)
        if (adminId) {
          let email = adminEmailById.get(adminId)
          if (email === undefined) {
            const admin = await this.admins.findById(adminId)
            email = admin?.email ?? adminId
            adminEmailById.set(adminId, email)
          }
          actorName = email
        }
      }
      eventsWithActor.push({ ...e, actorName })
    }
    return {
      user: {
        id: userId,
        status: user.getStatus().raw,
        lastSeq: user.getLastSeq(),
        verifiedAt: user.verifiedAt,
      },
      profile,
      identities,
      events: eventsWithActor,
      sessions: sessions.map((s) => ({ key: s.key, ...s.payload })),
      latestBan: ban,
      pendingEmailChange: await this.emailChanges.hasPending(userId),
      pendingPasswordReset: await this.passwordResets.hasPending(userId),
    }
  }

  /** banned → user_bans / unbanned → user_unbans。admin 参照が無ければ null（表示は actor_type ラベルへ） */
  private async resolveAdminActorId(e: {
    id: number
    type: string
  }): Promise<string | null> {
    if (e.type === 'banned') {
      return (await this.bans.findByEventId(e.id))?.adminUserId ?? null
    }
    if (e.type === 'unbanned') {
      return (await this.unbans.findByEventId(e.id))?.adminUserId ?? null
    }
    return null
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
