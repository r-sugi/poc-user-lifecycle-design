import { Hono } from 'hono'
import type { AppBindings } from '../../container'
import { createContainer } from '../../container'
import { AppError } from '../../lib/errors'
import {
  PurgeExpiredTokensUseCase,
  PurgeWithdrawnPiiUseCase,
} from '../../usecases/batch/BatchUseCases'

export const internalBatchApi = new Hono<AppBindings>()

internalBatchApi.post('/:job', async (c) => {
  const secret = c.req.header('X-Internal-Batch-Secret')
  if (!secret || secret !== c.env.INTERNAL_BATCH_SECRET) {
    throw new AppError('unauthorized', 'Invalid batch secret', 401)
  }
  const job = c.req.param('job')
  const { db } = createContainer(c)

  if (job === 'purge-withdrawn-pii') {
    const result = await new PurgeWithdrawnPiiUseCase(db).execute()
    return c.json({ job, ...result })
  }
  if (job === 'purge-expired-tokens') {
    const result = await new PurgeExpiredTokensUseCase(db).execute()
    return c.json({ job, ...result })
  }
  throw new AppError('not_found', `Unknown job: ${job}`, 404)
})
