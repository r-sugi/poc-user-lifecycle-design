import type { Context } from 'hono'
import { Email } from '../../domain/shared/Email'
import { AppError } from '../../lib/errors'
import type { UserIdentityRepository } from '../../repositories/UserIdentityRepository'
import type { UserProfileRepository } from '../../repositories/UserProfileRepository'
import type { UserRepository } from '../../repositories/UserRepository'
import type { PasswordHashingService } from '../../services/PasswordHashingService'
import type { SessionService } from '../../services/SessionService'

export class LoginUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly profiles: UserProfileRepository,
    private readonly identities: UserIdentityRepository,
    private readonly hashing: PasswordHashingService,
    private readonly sessions: SessionService,
  ) {}

  async execute(
    input: { email: string; password: string; userAgent?: string; ipAddress?: string },
    c?: Context,
  ) {
    const email = Email.create(input.email).toString()
    const profile = await this.profiles.findByEmail(email)
    if (!profile) throw new AppError('invalid_credentials', 'Invalid email or password', 401)
    const user = await this.users.findById(profile.userId)
    if (!user) throw new AppError('invalid_credentials', 'Invalid email or password', 401)
    const status = user.getStatus().raw
    if (status === 'banned') throw new AppError('banned', 'User is banned', 403)
    if (status === 'withdrawn') throw new AppError('withdrawn', 'User is withdrawn', 403)

    const identity = await this.identities.findPasswordIdentity(user.id.toString())
    if (!identity?.passwordHash) {
      throw new AppError('invalid_credentials', 'Invalid email or password', 401)
    }
    const ok = await this.hashing.verify(input.password, identity.passwordHash)
    if (!ok) throw new AppError('invalid_credentials', 'Invalid email or password', 401)

    await this.sessions.issueUserSession(
      user.id.toString(),
      {
        userAgent: input.userAgent ?? '',
        ipAddress: input.ipAddress ?? '',
      },
      c,
    )
    return { userId: user.id.toString(), status }
  }
}
