import { UserId } from './UserId'
import { UserStatus } from './UserStatus'

export class User {
  private constructor(
    readonly id: UserId,
    private status: UserStatus,
    private lastSeq: number,
    readonly verifiedAt: string,
    readonly createdAt: string,
    private updatedAt: string,
  ) {}

  static restore(params: {
    id: string
    status: string
    lastSeq: number
    verifiedAt: string
    createdAt: string
    updatedAt: string
  }): User {
    return new User(
      UserId.create(params.id),
      UserStatus.of(params.status),
      params.lastSeq,
      params.verifiedAt,
      params.createdAt,
      params.updatedAt,
    )
  }

  getStatus(): UserStatus {
    return this.status
  }

  getLastSeq(): number {
    return this.lastSeq
  }

  getUpdatedAt(): string {
    return this.updatedAt
  }

  /** 楽観ロック前提の遷移。成功後 nextSeq を返す */
  transitionTo(to: UserStatus, expectedSeq: number, nowIso: string): number {
    if (this.lastSeq !== expectedSeq) {
      throw new Error('optimistic_lock_conflict')
    }
    if (!this.status.canTransitionTo(to)) {
      throw new Error(`invalid_transition:${this.status.raw}->${to.raw}`)
    }
    this.status = to
    this.lastSeq = expectedSeq + 1
    this.updatedAt = nowIso
    return this.lastSeq
  }
}
