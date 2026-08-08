import { Hono } from 'hono'
import type { AppBindings } from '../../container'
import { createContainer } from '../../container'
import { parseOrThrow } from '../../lib/validate'
import { requireAdmin } from '../../middleware/requireAdmin'
import { adminLoginSchema, banSchema } from '../schemas/admin'

export const adminApi = new Hono<AppBindings>()

adminApi.post('/login', async (c) => {
  const body = parseOrThrow(adminLoginSchema, await c.req.json())
  const { adminLogin } = createContainer(c)
  return c.json(
    await adminLogin.execute(
      {
        ...body,
        userAgent: c.req.header('user-agent') ?? '',
        ipAddress: c.req.header('cf-connecting-ip') ?? '',
      },
      c,
    ),
  )
})

adminApi.post('/logout', async (c) => {
  const { sessionService } = createContainer(c)
  await sessionService.logoutAdmin(c)
  return c.json({ ok: true })
})

adminApi.get('/users', requireAdmin, async (c) => {
  const email = c.req.query('email')
  const { searchUsers } = createContainer(c)
  return c.json({ users: await searchUsers.execute(email) })
})

adminApi.get('/users/:id', requireAdmin, async (c) => {
  const { getUserDetail } = createContainer(c)
  return c.json(await getUserDetail.execute(c.req.param('id')))
})

adminApi.get('/users/:id/events', requireAdmin, async (c) => {
  const { getUserDetail } = createContainer(c)
  const detail = await getUserDetail.execute(c.req.param('id'))
  return c.json({ events: detail.events })
})

adminApi.post('/users/:id/ban', requireAdmin, async (c) => {
  const body = parseOrThrow(banSchema, await c.req.json())
  const { banUser } = createContainer(c)
  return c.json(
    await banUser.execute({
      userId: c.req.param('id'),
      adminUserId: c.get('adminId')!,
      ...body,
    }),
  )
})

adminApi.post('/users/:id/unban', requireAdmin, async (c) => {
  const { unbanUser } = createContainer(c)
  return c.json(
    await unbanUser.execute({
      userId: c.req.param('id'),
      adminUserId: c.get('adminId')!,
    }),
  )
})

adminApi.post('/users/:id/purge-pii', requireAdmin, async (c) => {
  const { forcePurgeUserPii } = createContainer(c)
  return c.json(await forcePurgeUserPii.execute({ userId: c.req.param('id') }))
})

adminApi.post('/users/:id/anonymize-pii', requireAdmin, async (c) => {
  const { forceAnonymizeUserPii } = createContainer(c)
  return c.json(await forceAnonymizeUserPii.execute({ userId: c.req.param('id') }))
})
