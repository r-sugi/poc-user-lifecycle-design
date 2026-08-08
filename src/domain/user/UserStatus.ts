export type UserStatusValue = 'active' | 'withdrawn' | 'banned'

const ALLOWED: Record<UserStatusValue, readonly UserStatusValue[]> = {
  active: ['withdrawn', 'banned'],
  withdrawn: ['active'],
  banned: ['active'],
}

export class UserStatus {
  private constructor(private readonly value: UserStatusValue) {}

  static active(): UserStatus {
    return new UserStatus('active')
  }

  static of(raw: string): UserStatus {
    if (raw !== 'active' && raw !== 'withdrawn' && raw !== 'banned') {
      throw new Error(`Invalid UserStatus: ${raw}`)
    }
    return new UserStatus(raw)
  }

  get raw(): UserStatusValue {
    return this.value
  }

  canTransitionTo(to: UserStatus): boolean {
    return ALLOWED[this.value].includes(to.value)
  }

  equals(other: UserStatus): boolean {
    return this.value === other.value
  }
}
