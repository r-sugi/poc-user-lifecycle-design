/**
 * One-shot: withdraw U01 → login fails → admin cancel → login ok
 * 実行: npx tsx scripts/verify-withdraw-cancel.ts
 */
import { getPlatformProxy } from 'wrangler'
import { createDb } from '../src/db/client'
import type { SessionRevocationQueueGateway } from '../src/gateways/SessionRevocationQueueGateway'
import { UserIdentityRepository } from '../src/repositories/UserIdentityRepository'
import { UserProfileRepository } from '../src/repositories/UserProfileRepository'
import { UserRepository } from '../src/repositories/UserRepository'
import { UserStatusEventRepository } from '../src/repositories/UserStatusEventRepository'
import { PasswordHashingService } from '../src/services/PasswordHashingService'
import type { SessionService } from '../src/services/SessionService'
import { UserStatusTransitionService } from '../src/services/UserStatusTransitionService'
import { LoginUseCase } from '../src/usecases/login/LoginUseCase'
import { CancelWithdrawUseCase, WithdrawUseCase } from '../src/usecases/withdraw/WithdrawUseCases'

const noopQueue = { async enqueue() {} } as unknown as SessionRevocationQueueGateway
const noopSessions = { async issueUserSession() {} } as unknown as SessionService

async function main() {
  const proxy = await getPlatformProxy({ persist: true })
  const env = proxy.env as unknown as CloudflareBindings
  const db = createDb(env.DB)
  const userRepo = new UserRepository(db)
  const eventRepo = new UserStatusEventRepository(db)
  const profileRepo = new UserProfileRepository(db)
  const identityRepo = new UserIdentityRepository(db)
  const hashing = new PasswordHashingService()
  const transitions = new UserStatusTransitionService(userRepo, noopQueue)
  const withdraw = new WithdrawUseCase(transitions)
  const cancel = new CancelWithdrawUseCase(userRepo, eventRepo, profileRepo, transitions)
  const login = new LoginUseCase(userRepo, profileRepo, identityRepo, hashing, noopSessions)

  const userId = 'seed-user-01'
  const email = 'alice.active@example.com'
  const password = process.env.SEED_USER_PASSWORD || 'Password123!'

  console.log('1. withdraw', userId)
  await withdraw.execute({ userId, reasonCode: 'no_longer_needed' })
  const afterWithdraw = await userRepo.findById(userId)
  console.log('   status=', afterWithdraw?.getStatus().raw, 'lastSeq=', afterWithdraw?.getLastSeq())

  console.log('2. login should fail (withdrawn)')
  try {
    await login.execute({ email, password })
    throw new Error('login should have failed')
  } catch (e: unknown) {
    const err = e as { code?: string; message?: string }
    console.log('   ok rejected:', err.code || err.message)
  }

  console.log('3. admin cancel-withdraw')
  await cancel.execute({ userId, adminUserId: 'seed-admin-01' })
  const afterCancel = await userRepo.findById(userId)
  const events = await eventRepo.listByUserId(userId)
  const last = events.at(-1)
  console.log(
    '   status=',
    afterCancel?.getStatus().raw,
    'last event=',
    last?.type,
    'actor=',
    last?.actorType,
    'actorId=',
    last?.actorId,
  )

  console.log('4. login should succeed')
  const result = await login.execute({ email, password })
  console.log('   login ok userId=', result.userId)

  if (last?.type !== 'withdraw_cancelled' || last.actorType !== 'admin' || last.actorId !== 'seed-admin-01') {
    throw new Error('expected withdraw_cancelled with actor_type=admin and actor_id')
  }
  console.log('PASS')
  await proxy.dispose()
}

main().catch((e) => {
  console.error('FAIL', e)
  process.exit(1)
})
