import { ActorType, StatusEventType } from '../domain/shared/StatusEventEnums'
import { UserStatus } from '../domain/user/UserStatus'
import { AppError } from '../lib/errors'
import type { SessionRevocationQueueGateway } from '../gateways/SessionRevocationQueueGateway'
import type { SessionRevocationMessage } from '../gateways/SessionRevocationQueueGateway'
import type { UserRepository } from '../repositories/UserRepository'

export class UserStatusTransitionService {
  constructor(
    private readonly users: UserRepository,
    private readonly queue: SessionRevocationQueueGateway,
  ) {}

  async withdraw(params: {
    userId: string
    reasonCode: string
    reasonText?: string
    enqueueRevocation?: boolean
  }): Promise<void> {
    await this.transition({
      userId: params.userId,
      to: UserStatus.of('withdrawn'),
      eventType: StatusEventType.Withdrawn,
      actorType: ActorType.User,
      withdrawal: { reasonCode: params.reasonCode, reasonText: params.reasonText },
      revoke: params.enqueueRevocation === false ? null : 'withdraw',
    })
  }

  async cancelWithdraw(params: { userId: string }): Promise<void> {
    await this.transition({
      userId: params.userId,
      to: UserStatus.active(),
      eventType: StatusEventType.WithdrawCancelled,
      actorType: ActorType.Admin,
      revoke: null,
    })
  }

  async ban(params: {
    userId: string
    adminUserId: string
    reasonCode: string
    reasonText?: string
  }): Promise<void> {
    await this.transition({
      userId: params.userId,
      to: UserStatus.of('banned'),
      eventType: StatusEventType.Banned,
      actorType: ActorType.Admin,
      ban: {
        adminUserId: params.adminUserId,
        reasonCode: params.reasonCode,
        reasonText: params.reasonText,
      },
      revoke: 'ban',
    })
  }

  async unban(params: { userId: string; adminUserId: string }): Promise<void> {
    await this.transition({
      userId: params.userId,
      to: UserStatus.active(),
      eventType: StatusEventType.Unbanned,
      actorType: ActorType.Admin,
      unban: { adminUserId: params.adminUserId },
      revoke: null,
    })
  }

  private async transition(params: {
    userId: string
    to: UserStatus
    eventType: string
    actorType: string
    withdrawal?: { reasonCode: string; reasonText?: string }
    ban?: { adminUserId: string; reasonCode: string; reasonText?: string }
    unban?: { adminUserId: string }
    revoke: SessionRevocationMessage['reason'] | null
  }): Promise<void> {
    const user = await this.users.findById(params.userId)
    if (!user) throw new AppError('not_found', 'User not found', 404)
    const expectedSeq = user.getLastSeq()
    const now = new Date().toISOString()
    let nextSeq: number
    try {
      nextSeq = user.transitionTo(params.to, expectedSeq, now)
    } catch (e) {
      throw new AppError('invalid_transition', e instanceof Error ? e.message : 'invalid', 400)
    }

    await this.users.applyStatusTransition({
      userId: params.userId,
      expectedSeq,
      nextStatus: params.to.raw,
      nextSeq,
      updatedAt: now,
      event: {
        type: params.eventType,
        actorType: params.actorType,
        createdAt: now,
      },
      withdrawal: params.withdrawal
        ? {
            reasonCode: params.withdrawal.reasonCode,
            reasonText: params.withdrawal.reasonText ?? null,
            createdAt: now,
          }
        : undefined,
      ban: params.ban
        ? {
            adminUserId: params.ban.adminUserId,
            reasonCode: params.ban.reasonCode,
            reasonText: params.ban.reasonText ?? null,
            createdAt: now,
          }
        : undefined,
      unban: params.unban
        ? {
            adminUserId: params.unban.adminUserId,
            createdAt: now,
          }
        : undefined,
    })

    if (params.revoke) {
      await this.queue.enqueue({ userId: params.userId, reason: params.revoke })
    }
  }
}
