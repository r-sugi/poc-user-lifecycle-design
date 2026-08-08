import type { Context } from 'hono'
import { AppError } from '../../lib/errors'
import type { UserRepository } from '../../repositories/UserRepository'
import type { SessionService } from '../../services/SessionService'
import { isDevLoginEnabled } from '../../lib/appEnv'

/**
 * POC 検証トップ用。パスワード検証をスキップして userId でセッション発行する。
 * APP_ENV=production では拒否。
 */
export class DevLoginAsUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly sessions: SessionService,
  ) {}

  async execute(
    input: { userId: string; userAgent?: string; ipAddress?: string },
    c: Context,
  ) {
    if (!isDevLoginEnabled(c.env.APP_ENV)) {
      throw new AppError('forbidden', 'Dev login is disabled', 403)
    }
    const user = await this.users.findById(input.userId)
    if (!user) throw new AppError('not_found', 'User not found', 404)
    const status = user.getStatus().raw
    if (status === 'banned') {
      throw new AppError('banned', 'BAN 中のユーザーにはログインできません', 403)
    }
    if (status === 'withdrawn') {
      throw new AppError('withdrawn', '退会中のユーザーにはログインできません', 403)
    }

    await this.sessions.logoutUser(c).catch(() => undefined)
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
