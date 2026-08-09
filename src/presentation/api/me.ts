import { Hono } from 'hono'
import type { AppBindings } from '../../container'
import { createContainer } from '../../container'
import { parseOrThrow } from '../../lib/validate'
import { requireUser } from '../../middleware/requireUser'
import { requestEmailChangeSchema } from '../schemas/emailChange'
import { changePasswordSchema, updateProfileSchema } from '../schemas/me'
import { withdrawSchema } from '../schemas/withdraw'

export const meApi = new Hono<AppBindings>()
meApi.use('*', requireUser)

meApi.get('/', async (c) => {
  const { getMe } = createContainer(c)
  return c.json(await getMe.execute(c.get('userId')!))
})

meApi.patch('/', async (c) => {
  const body = parseOrThrow(updateProfileSchema, await c.req.json())
  const { updateProfile } = createContainer(c)
  return c.json(await updateProfile.execute({ userId: c.get('userId')!, ...body }))
})

meApi.put('/password', async (c) => {
  const body = parseOrThrow(changePasswordSchema, await c.req.json())
  const { changePassword } = createContainer(c)
  return c.json(await changePassword.execute({ userId: c.get('userId')!, ...body }))
})

meApi.post('/email', async (c) => {
  const body = parseOrThrow(requestEmailChangeSchema, await c.req.json())
  const { requestEmailChange } = createContainer(c)
  return c.json(await requestEmailChange.execute({ userId: c.get('userId')!, ...body }))
})

meApi.post('/withdraw', async (c) => {
  const body = parseOrThrow(withdrawSchema, await c.req.json())
  const { withdraw } = createContainer(c)
  return c.json(await withdraw.execute({ userId: c.get('userId')!, ...body }))
})
