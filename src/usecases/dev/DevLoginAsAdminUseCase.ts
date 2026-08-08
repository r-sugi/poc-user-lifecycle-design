import type { Context } from 'hono'
import { AppError } from '../../lib/errors'
import { isDevLoginEnabled } from '../../lib/appEnv'
import type { AdminUserRepository } from '../../repositories/AdminUserRepository'
import type { SessionService } from '../../services/SessionService'

/**
 * POC 検証用。パスワード検証をスキップして adminId で管理者セッション発行する。
 * APP_ENV=production では拒否。
 */
export class DevLoginAsAdminUseCase {
  constructor(
    private readonly admins: AdminUserRepository,
    private readonly sessions: SessionService,
  ) {}

  async execute(
    input: { adminId: string; userAgent?: string; ipAddress?: string },
    c: Context,
  ) {
    if (!isDevLoginEnabled(c.env.APP_ENV)) {
      throw new AppError('forbidden', 'Dev login is disabled', 403)
    }
    const admin = await this.admins.findById(input.adminId)
    if (!admin) throw new AppError('not_found', 'Admin not found', 404)

    await this.sessions.logoutAdmin(c).catch(() => undefined)
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
