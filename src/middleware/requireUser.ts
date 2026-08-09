import type { MiddlewareHandler } from 'hono'
import type { AppBindings } from '../container'
import { createContainer } from '../container'
import { AppError } from '../lib/errors'

export type AuthVariables = {
  userId: string
  adminId: string
}

export const requireUser: MiddlewareHandler<
  AppBindings & { Variables: Partial<AuthVariables> }
> = async (c, next) => {
  const { sessionService } = createContainer(c)
  const session = await sessionService.resolveFromUserCookie(c)
  if (!session) throw new AppError('unauthorized', 'Login required', 401)
  c.set('userId', session.userId)
  await next()
}

export const requireAdmin: MiddlewareHandler<
  AppBindings & { Variables: Partial<AuthVariables> }
> = async (c, next) => {
  const { sessionService, adminRepo } = createContainer(c)
  const session = await sessionService.resolveFromAdminCookie(c)
  if (!session) throw new AppError('unauthorized', 'Admin login required', 401)
  const admin = await adminRepo.findById(session.adminId)
  if (!admin || admin.isDisabled) {
    await sessionService.logoutAdmin(c)
    throw new AppError('admin_disabled', 'Admin account disabled', 403)
  }
  c.set('adminId', session.adminId)
  await next()
}

export const requireUserPage: MiddlewareHandler<AppBindings> = async (c, next) => {
  const { sessionService } = createContainer(c)
  const session = await sessionService.resolveFromUserCookie(c)
  if (!session) return c.redirect('/')
  c.set('userId', session.userId)
  await next()
}

/** 管理画面 HTML。admin_session が無ければ管理者ログイン（一覧）へ。 */
export const requireAdminPage: MiddlewareHandler<AppBindings> = async (c, next) => {
  const { sessionService, adminRepo } = createContainer(c)
  const session = await sessionService.resolveFromAdminCookie(c)
  if (!session) return c.redirect('/admin/login')
  const admin = await adminRepo.findById(session.adminId)
  if (!admin || admin.isDisabled) {
    await sessionService.logoutAdmin(c)
    return c.redirect('/admin/login')
  }
  c.set('adminId', session.adminId)
  await next()
}
