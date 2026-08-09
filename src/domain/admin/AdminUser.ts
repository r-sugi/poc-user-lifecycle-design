export class AdminUser {
  private constructor(
    readonly id: string,
    readonly email: string,
    readonly passwordHash: string,
    readonly createdAt: string,
    readonly disabledAt: string | null,
  ) {}

  static restore(params: {
    id: string
    email: string
    passwordHash: string
    createdAt: string
    disabledAt?: string | null
  }): AdminUser {
    return new AdminUser(
      params.id,
      params.email,
      params.passwordHash,
      params.createdAt,
      params.disabledAt ?? null,
    )
  }

  get isDisabled(): boolean {
    return !!this.disabledAt
  }
}
