import type { AdminUserRepository } from '../repositories/AdminUserRepository'
import type { SessionService } from './SessionService'

/** disabled_at 設定と同時に admin セッションを失効 */
export class DisableAdminService {
  constructor(
    private readonly admins: AdminUserRepository,
    private readonly sessions: SessionService,
  ) {}

  async disable(adminId: string, disabledAt = new Date().toISOString()): Promise<void> {
    await this.admins.setDisabledAt(adminId, disabledAt)
    await this.sessions.revokeAllAdminSessions(adminId)
  }
}
