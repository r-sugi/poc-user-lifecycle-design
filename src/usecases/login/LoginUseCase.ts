import type { Context } from 'hono'
import { Email } from '../../domain/shared/Email'
import { AppError } from '../../lib/errors'
import type { UserIdentityRepository } from '../../repositories/UserIdentityRepository'
import type { UserProfileRepository } from '../../repositories/UserProfileRepository'
import type { UserRepository } from '../../repositories/UserRepository'
import type { PasswordHashingService } from '../../services/PasswordHashingService'
import type { SessionService } from '../../services/SessionService'

/**
 * 存在しないアカウントでも verify を回すための定数時間用ダミー（固定 salt・600k iter）。
 * 平文は公開不要（ランダム試行値で生成した固定ハッシュ）。
 */
const DUMMY_PASSWORD_HASH =
  'pbkdf2$600000$00000000000000000000000000000000$a33bbc39669d8461291d8f89cccf57124661aa818150144af9de5baa32ac7878'

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
    const identity = profile ? await this.identities.findPasswordIdentity(profile.userId) : null
    const passwordHash = identity?.passwordHash ?? DUMMY_PASSWORD_HASH
    const ok = await this.hashing.verify(input.password, passwordHash)
    if (!profile || !identity?.passwordHash || !ok) {
      throw new AppError('invalid_credentials', 'Invalid email or password', 401)
    }

    const user = await this.users.findById(profile.userId)
    if (!user) throw new AppError('invalid_credentials', 'Invalid email or password', 401)
    const status = user.getStatus().raw
    if (status === 'banned') throw new AppError('banned', 'User is banned', 403)
    if (status === 'withdrawn') throw new AppError('withdrawn', 'User is withdrawn', 403)

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
