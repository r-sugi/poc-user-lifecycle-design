export class AdminUser {
  private constructor(
    readonly id: string,
    readonly email: string,
    readonly passwordHash: string,
    readonly createdAt: string,
  ) {}

  static restore(params: {
    id: string
    email: string
    passwordHash: string
    createdAt: string
  }): AdminUser {
    return new AdminUser(params.id, params.email, params.passwordHash, params.createdAt)
  }
}
