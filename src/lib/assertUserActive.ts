import { AppError } from './errors'
import type { User } from '../domain/user/User'

/** banned/withdrawn を GetMe と同様 401 で拒否 */
export function assertUserActive(user: User): void {
  const status = user.getStatus().raw
  if (status === 'banned') throw new AppError('banned', 'User is banned', 401)
  if (status === 'withdrawn') throw new AppError('withdrawn', 'User is withdrawn', 401)
}
