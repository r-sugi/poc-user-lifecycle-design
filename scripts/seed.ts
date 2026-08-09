/**
 * ローカル D1 向けシード（設計書 §21）
 * KV セッションは投入しない。
 *
 * 実行: npm run db:migrate:local && npm run seed
 */
import { getPlatformProxy } from 'wrangler'
import { createDb } from '../src/db/client'
import * as schema from '../src/db/schema'

import { PasswordHashingService } from '../src/services/PasswordHashingService'

function daysOffset(days: number, base = new Date()): string {
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000).toISOString()
}

async function sha256Hex(raw: string): Promise<string> {
  const dig = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))
  return [...new Uint8Array(dig)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function main() {
  const userPassword = process.env.SEED_USER_PASSWORD || 'Password123!'
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'AdminPass123!'

  const proxy = await getPlatformProxy({ persist: true })
  const env = proxy.env as unknown as CloudflareBindings
  const db = createDb(env.DB)
  const hashing = new PasswordHashingService()
  const base = new Date()

  console.log('Clearing tables...')
  const tables = [
    'seed_signup_labels',
    'seed_user_labels',
    'user_unbans',
    'user_bans',
    'user_withdrawals',
    'user_status_events',
    'email_change_requests',
    'password_resets',
    'user_identities',
    'user_profiles',
    'signup_verifications',
    'users',
    'admin_users',
  ]
  for (const t of tables) {
    await env.DB.prepare(`DELETE FROM ${t}`).run()
  }

  const adminHash = await hashing.hash(adminPassword)
  for (let i = 1; i <= 5; i++) {
    await db.insert(schema.adminUsers).values({
      id: `seed-admin-0${i}`,
      email: `admin${i}@example.com`,
      passwordHash: adminHash,
      createdAt: base.toISOString(),
      // A5 予備を disabled にし、無効化手段を検証可能にする
      disabledAt: i === 5 ? base.toISOString() : null,
    })
  }

  const userHash = await hashing.hash(userPassword)
  type SeedUser = {
    id: string
    email: string
    displayName: string
    status: 'active' | 'withdrawn' | 'banned'
    providers: Array<'password' | 'google'>
    verifiedDaysAgo: number
    initialLabel: string
    events: Array<{ type: string; daysAgo: number; reasonCode?: string; adminId?: string }>
    emailChange?: boolean
    passwordReset?: boolean
  }

  const seedUsers: SeedUser[] = [
    {
      id: 'seed-user-01',
      email: 'alice.active@example.com',
      displayName: 'Alice Active',
      status: 'active',
      providers: ['password'],
      verifiedDaysAgo: 90,
      initialLabel: 'active / passwordのみ',
      events: [{ type: 'activated', daysAgo: 90 }],
    },
    {
      id: 'seed-user-02',
      email: 'ben.google@example.com',
      displayName: 'Ben Google',
      status: 'active',
      providers: ['google'],
      verifiedDaysAgo: 60,
      initialLabel: 'active / Googleのみ',
      events: [{ type: 'activated', daysAgo: 60 }],
    },
    {
      id: 'seed-user-03',
      email: 'carol.both@example.com',
      displayName: 'Carol Both',
      status: 'active',
      providers: ['password', 'google'],
      verifiedDaysAgo: 50,
      initialLabel: 'active / password+Google',
      events: [{ type: 'activated', daysAgo: 50 }],
    },
    {
      id: 'seed-user-04',
      email: 'dave.emailchange@example.com',
      displayName: 'Dave EmailChange',
      status: 'active',
      providers: ['password'],
      verifiedDaysAgo: 40,
      initialLabel: 'active / メール変更申請中',
      events: [{ type: 'activated', daysAgo: 40 }],
      emailChange: true,
    },
    {
      id: 'seed-user-05',
      email: 'erin.reset@example.com',
      displayName: 'Erin Reset',
      status: 'active',
      providers: ['password'],
      verifiedDaysAgo: 40,
      initialLabel: 'active / パスワードリセット未消費',
      events: [{ type: 'activated', daysAgo: 40 }],
      passwordReset: true,
    },
    {
      id: 'seed-user-06',
      email: 'frank.withdrawn@example.com',
      displayName: 'Frank Withdrawn',
      status: 'withdrawn',
      providers: ['password'],
      verifiedDaysAgo: 100,
      initialLabel: 'withdrawn / 退会後30日未満（取消可・PII残・残り27日）',
      events: [
        { type: 'activated', daysAgo: 100 },
        { type: 'withdrawn', daysAgo: 3, reasonCode: 'no_longer_needed' },
      ],
    },
    {
      id: 'seed-user-07',
      email: 'grace.purge@example.com',
      displayName: 'Grace Purge',
      status: 'withdrawn',
      providers: ['password'],
      verifiedDaysAgo: 120,
      initialLabel: 'withdrawn / 退会後30日経過（PII削除バッチ対象）',
      events: [
        { type: 'activated', daysAgo: 120 },
        { type: 'withdrawn', daysAgo: 31, reasonCode: 'privacy' },
      ],
    },
    {
      id: 'seed-user-08',
      email: 'hank.banned@example.com',
      displayName: 'Hank Banned',
      status: 'banned',
      providers: ['password'],
      verifiedDaysAgo: 80,
      initialLabel: 'banned / abuse',
      events: [
        { type: 'activated', daysAgo: 80 },
        { type: 'banned', daysAgo: 5, reasonCode: 'abuse', adminId: 'seed-admin-01' },
      ],
    },
    {
      id: 'seed-user-09',
      email: 'ivy.banned.spam@example.com',
      displayName: 'Ivy Spam',
      status: 'banned',
      providers: ['password'],
      verifiedDaysAgo: 70,
      initialLabel: 'banned / spam',
      events: [
        { type: 'activated', daysAgo: 70 },
        { type: 'banned', daysAgo: 4, reasonCode: 'spam', adminId: 'seed-admin-02' },
      ],
    },
    {
      id: 'seed-user-10',
      email: 'jack.cancelled@example.com',
      displayName: 'Jack Cancelled',
      status: 'active',
      providers: ['password'],
      verifiedDaysAgo: 90,
      initialLabel: 'active / 退会取消済み（履歴あり）',
      events: [
        { type: 'activated', daysAgo: 90 },
        { type: 'withdrawn', daysAgo: 10, reasonCode: 'other' },
        { type: 'withdraw_cancelled', daysAgo: 8 },
      ],
    },
    {
      id: 'seed-user-11',
      email: 'kaori.veteran@example.com',
      displayName: '香織 Legacy',
      status: 'active',
      providers: ['password'],
      verifiedDaysAgo: 400,
      initialLabel: 'active / passwordのみ',
      events: [{ type: 'activated', daysAgo: 400 }],
    },
    {
      id: 'seed-user-12',
      email: 'leo.fresh@example.com',
      displayName: 'Leo Fresh',
      status: 'active',
      providers: ['password'],
      verifiedDaysAgo: 0,
      initialLabel: 'active / passwordのみ',
      events: [{ type: 'activated', daysAgo: 0 }],
    },
    {
      id: 'seed-user-13',
      email: 'mina.diverse@example.co.jp',
      displayName: '美奈 Diversité',
      status: 'active',
      providers: ['password'],
      verifiedDaysAgo: 20,
      initialLabel: 'active / passwordのみ',
      events: [{ type: 'activated', daysAgo: 20 }],
    },
    {
      id: 'seed-user-14',
      email: 'noah.unbanned@example.com',
      displayName: 'Noah Unbanned',
      status: 'active',
      providers: ['password'],
      verifiedDaysAgo: 60,
      initialLabel: 'active / BAN解除済み（履歴あり）',
      events: [
        { type: 'activated', daysAgo: 60 },
        { type: 'banned', daysAgo: 20, reasonCode: 'tos_violation', adminId: 'seed-admin-01' },
        { type: 'unbanned', daysAgo: 10, adminId: 'seed-admin-03' },
      ],
    },
    {
      id: 'seed-user-15',
      email: 'olivia.sessions@example.com',
      displayName: 'Olivia Sessions',
      status: 'active',
      providers: ['password'],
      verifiedDaysAgo: 5,
      initialLabel: 'active / passwordのみ',
      events: [{ type: 'activated', daysAgo: 5 }],
    },
    {
      id: 'seed-user-16',
      email: 'consumed.verify@example.com',
      displayName: 'Consumed Verify',
      status: 'active',
      providers: ['password'],
      verifiedDaysAgo: 2,
      initialLabel: 'active / passwordのみ',
      events: [{ type: 'activated', daysAgo: 2 }],
    },
  ]

  for (const u of seedUsers) {
    const verifiedAt = daysOffset(-u.verifiedDaysAgo, base)
    await db.insert(schema.users).values({
      id: u.id,
      status: u.status,
      lastSeq: u.events.length,
      verifiedAt,
      createdAt: verifiedAt,
      updatedAt: daysOffset(-u.events[u.events.length - 1].daysAgo, base),
    })
    await db.insert(schema.userProfiles).values({
      userId: u.id,
      email: u.email,
      displayName: u.displayName,
      createdAt: verifiedAt,
      updatedAt: verifiedAt,
    })
    for (const p of u.providers) {
      await db.insert(schema.userIdentities).values({
        id: `${u.id}-${p}`,
        userId: u.id,
        provider: p,
        providerUid: p === 'password' ? u.id : `google-sub-${u.email}`,
        passwordHash: p === 'password' ? userHash : null,
        createdAt: verifiedAt,
      })
    }
    let seq = 0
    for (const ev of u.events) {
      seq += 1
      const created = daysOffset(-ev.daysAgo, base)
      const actorId =
        ev.type === 'banned' || ev.type === 'unbanned' || ev.type === 'withdraw_cancelled'
          ? (ev.adminId ?? null)
          : null
      await db.insert(schema.userStatusEvents).values({
        userId: u.id,
        seq,
        type: ev.type,
        actorType:
          ev.type === 'banned' || ev.type === 'unbanned' || ev.type === 'withdraw_cancelled'
            ? 'admin'
            : 'user',
        actorId,
        createdAt: created,
      })
      if (ev.type === 'withdrawn' && ev.reasonCode) {
        await db.insert(schema.userWithdrawals).values({
          userId: u.id,
          seq,
          reasonCode: ev.reasonCode,
          reasonText: null,
          createdAt: created,
        })
      }
      if (ev.type === 'banned' && ev.reasonCode) {
        await db.insert(schema.userBans).values({
          userId: u.id,
          seq,
          reasonCode: ev.reasonCode,
          reasonText: null,
          createdAt: created,
        })
      }
      if (ev.type === 'unbanned') {
        await db.insert(schema.userUnbans).values({
          userId: u.id,
          seq,
          createdAt: created,
        })
      }
    }
    if (u.emailChange) {
      await db.insert(schema.emailChangeRequests).values({
        id: `${u.id}-emchange`,
        userId: u.id,
        newEmail: 'dave.new@example.com',
        tokenHash: await sha256Hex('seed-email-change-u04'),
        expiresAt: daysOffset(1, base),
        consumedAt: null,
        createdAt: base.toISOString(),
      })
    }
    if (u.passwordReset) {
      await db.insert(schema.passwordResets).values({
        id: `${u.id}-pwreset`,
        userId: u.id,
        tokenHash: await sha256Hex('seed-password-reset-u05'),
        expiresAt: daysOffset(0.04, base),
        consumedAt: null,
        createdAt: base.toISOString(),
        rawToken: 'seed-password-reset-u05',
      })
    }
    await db.insert(schema.seedUserLabels).values({
      userId: u.id,
      initialStateLabel: u.initialLabel,
      createdAt: base.toISOString(),
    })
  }

  const signupDefs = [
    {
      id: 'seed-signup-s1',
      email: 'pending.verify@example.com',
      createdAt: base.toISOString(),
      expiresAt: daysOffset(1, base),
      consumedAt: null as string | null,
      tokenRaw: 'seed-signup-token-s1',
      label: 'メール確認待ち（有効）',
    },
    {
      id: 'seed-signup-s2',
      email: 'expired.verify@example.com',
      createdAt: daysOffset(-2, base),
      expiresAt: daysOffset(-1, base),
      consumedAt: null,
      tokenRaw: 'seed-signup-token-s2',
      label: 'メール確認待ち（期限切れ）',
    },
    {
      id: 'seed-signup-s3',
      email: 'consumed.verify@example.com',
      createdAt: daysOffset(-3, base),
      expiresAt: daysOffset(-2, base),
      consumedAt: daysOffset(-2, base),
      tokenRaw: 'seed-signup-token-s3',
      label: 'メール確認待ち（消費済み・users作成済）',
    },
    {
      id: 'seed-signup-s4',
      email: 'resend.pending@example.com',
      createdAt: daysOffset(-1, base),
      expiresAt: daysOffset(-0.5, base),
      consumedAt: daysOffset(-0.1, base),
      tokenRaw: 'seed-signup-token-s4',
      label: 'メール確認待ち（再送で無効化した旧行）',
    },
    {
      id: 'seed-signup-s5',
      email: 'resend.pending@example.com',
      createdAt: base.toISOString(),
      expiresAt: daysOffset(1, base),
      consumedAt: null,
      tokenRaw: 'seed-signup-token-s5',
      label: 'メール確認待ち（再送後・有効）',
    },
  ]

  for (const s of signupDefs) {
    await db.insert(schema.signupVerifications).values({
      id: s.id,
      email: s.email,
      passwordHash: userHash,
      tokenHash: await sha256Hex(s.tokenRaw),
      expiresAt: s.expiresAt,
      consumedAt: s.consumedAt,
      createdAt: s.createdAt,
    })
    await db.insert(schema.seedSignupLabels).values({
      signupVerificationId: s.id,
      initialStateLabel: s.label,
      rawToken: s.tokenRaw,
      displayName: s.email.split('@')[0] || 'User',
      createdAt: base.toISOString(),
    })
  }

  console.log('Seed complete: admin5 / user16 / signup5 / seed labels')
  console.log('User password:', userPassword)
  console.log('Admin password:', adminPassword)
  console.log('Signup raw tokens (POC):', signupDefs.map((s) => `${s.id}=${s.tokenRaw}`).join(', '))
  await proxy.dispose()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
