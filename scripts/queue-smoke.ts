import { getPlatformProxy } from 'wrangler'
import { SessionKvGateway } from '../src/gateways/SessionKvGateway'
import { SessionRevocationQueueGateway } from '../src/gateways/SessionRevocationQueueGateway'

async function main() {
  const proxy = await getPlatformProxy({ persist: true })
  const env = proxy.env as unknown as CloudflareBindings
  const kv = new SessionKvGateway(env.SESSIONS_KV)
  const key = 'session:user:seed-user-01:smoketest'
  await kv.put(key, { userAgent: 't', ipAddress: '1', createdAt: new Date().toISOString() }, 3600)
  console.log('before', await kv.listPrefix('session:user:seed-user-01:'))
  const q = new SessionRevocationQueueGateway(env.SESSION_REVOCATIONS)
  await q.enqueue({ userId: 'seed-user-01', reason: 'ban' })
  // note: queue consumer runs in vite/wrangler worker, not in this Node script.
  // This only verifies enqueue doesn't throw against local emulator.
  console.log('enqueued ok')
  await proxy.dispose()
}
main()
