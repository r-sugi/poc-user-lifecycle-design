import { TTL } from '../../config'
import { ReasonCode } from '../../domain/shared/ReasonCode'
import { AppError } from '../../lib/errors'
import type { UserProfileRepository } from '../../repositories/UserProfileRepository'
import type { UserRepository } from '../../repositories/UserRepository'
import type { UserStatusEventRepository } from '../../repositories/UserStatusEventRepository'
import type { UserStatusTransitionService } from '../../services/UserStatusTransitionService'
import { isAnonymizedProfile } from '../batch/BatchUseCases'

export class WithdrawUseCase {
  constructor(private readonly transitions: UserStatusTransitionService) {}

  async execute(input: { userId: string; reasonCode: string; reasonText?: string }) {
    const code = ReasonCode.withdraw(input.reasonCode)
    await this.transitions.withdraw({
      userId: input.userId,
      reasonCode: code.value,
      reasonText: input.reasonText,
    })
    return { ok: true as const }
  }
}

export class CancelWithdrawUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly events: UserStatusEventRepository,
    private readonly profiles: UserProfileRepository,
    private readonly transitions: UserStatusTransitionService,
  ) {}

  async execute(input: { userId: string; adminUserId: string }) {
    const user = await this.users.findById(input.userId)
    if (!user) throw new AppError('not_found', 'User not found', 404)
    if (user.getStatus().raw !== 'withdrawn') {
      throw new AppError('invalid_transition', 'Not withdrawn', 400)
    }
    const withdrawn = await this.events.findLatestOfType(input.userId, 'withdrawn')
    if (!withdrawn) throw new AppError('invalid_transition', 'No withdraw event', 400)
    const graceMs = TTL.withdrawGraceDays * 24 * 60 * 60 * 1000
    if (Date.now() - new Date(withdrawn.createdAt).getTime() > graceMs) {
      throw new AppError('grace_expired', 'Withdraw grace period expired', 400)
    }
    // 強制 PII 削除・匿名化は猶予を見ずにいつでも実行できる。取消時に profile が無い/
    // 匿名化済みのまま active に戻すと、ログインもマイページ表示もできない不整合ユーザーが生まれる。
    const profile = await this.profiles.findByUserId(input.userId)
    if (!profile || isAnonymizedProfile(profile)) {
      throw new AppError(
        'pii_already_removed',
        'Cannot cancel withdraw: PII already purged or anonymized',
        400,
      )
    }
    await this.transitions.cancelWithdraw({
      userId: input.userId,
      adminUserId: input.adminUserId,
    })
    return { ok: true as const }
  }
}
