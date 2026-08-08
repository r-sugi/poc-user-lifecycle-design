import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  status: text('status').notNull(), // active | withdrawn | banned
  lastSeq: integer('last_seq').notNull().default(0),
  verifiedAt: text('verified_at').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const userProfiles = sqliteTable(
  'user_profiles',
  {
    userId: text('user_id')
      .primaryKey()
      .references(() => users.id),
    email: text('email').notNull(),
    displayName: text('display_name').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [uniqueIndex('user_profiles_email_unique').on(t.email)],
)

export const userIdentities = sqliteTable(
  'user_identities',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    provider: text('provider').notNull(), // password | google
    providerUid: text('provider_uid').notNull(),
    passwordHash: text('password_hash'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [uniqueIndex('user_identities_provider_uid_unique').on(t.provider, t.providerUid)],
)

export const signupVerifications = sqliteTable(
  'signup_verifications',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    tokenHash: text('token_hash').notNull(),
    expiresAt: text('expires_at').notNull(),
    consumedAt: text('consumed_at'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [uniqueIndex('signup_verifications_token_hash_unique').on(t.tokenHash)],
)

export const passwordResets = sqliteTable(
  'password_resets',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    tokenHash: text('token_hash').notNull(),
    expiresAt: text('expires_at').notNull(),
    consumedAt: text('consumed_at'),
    createdAt: text('created_at').notNull(),
    /** POC 検証トップ「PW更新」用。申請時の生トークン（本番想定外） */
    rawToken: text('raw_token'),
  },
  (t) => [uniqueIndex('password_resets_token_hash_unique').on(t.tokenHash)],
)

export const emailChangeRequests = sqliteTable(
  'email_change_requests',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    newEmail: text('new_email').notNull(),
    tokenHash: text('token_hash').notNull(),
    expiresAt: text('expires_at').notNull(),
    consumedAt: text('consumed_at'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [uniqueIndex('email_change_requests_token_hash_unique').on(t.tokenHash)],
)

export const adminUsers = sqliteTable(
  'admin_users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (t) => [uniqueIndex('admin_users_email_unique').on(t.email)],
)

export const userStatusEvents = sqliteTable(
  'user_status_events',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    seq: integer('seq').notNull(),
    type: text('type').notNull(), // activated | withdrawn | withdraw_cancelled | banned | unbanned
    actorType: text('actor_type').notNull(), // user | admin | system
    createdAt: text('created_at').notNull(),
  },
  (t) => [uniqueIndex('user_status_events_user_seq_unique').on(t.userId, t.seq)],
)

export const userWithdrawals = sqliteTable('user_withdrawals', {
  eventId: integer('event_id')
    .primaryKey()
    .references(() => userStatusEvents.id),
  reasonCode: text('reason_code').notNull(),
  reasonText: text('reason_text'),
  createdAt: text('created_at').notNull(),
})

export const userBans = sqliteTable('user_bans', {
  eventId: integer('event_id')
    .primaryKey()
    .references(() => userStatusEvents.id),
  adminUserId: text('admin_user_id')
    .notNull()
    .references(() => adminUsers.id),
  reasonCode: text('reason_code').notNull(),
  reasonText: text('reason_text'),
  createdAt: text('created_at').notNull(),
})

/** BAN 解除の操作者（理由は不要。admin 表示解決用） */
export const userUnbans = sqliteTable('user_unbans', {
  eventId: integer('event_id')
    .primaryKey()
    .references(() => userStatusEvents.id),
  adminUserId: text('admin_user_id')
    .notNull()
    .references(() => adminUsers.id),
  createdAt: text('created_at').notNull(),
})

/** POC 検証トップ「初期状態」固定ラベル（シード時のみ INSERT） */
export const seedUserLabels = sqliteTable('seed_user_labels', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id),
  initialStateLabel: text('initial_state_label').notNull(),
  createdAt: text('created_at').notNull(),
})

export const seedSignupLabels = sqliteTable('seed_signup_labels', {
  signupVerificationId: text('signup_verification_id')
    .primaryKey()
    .references(() => signupVerifications.id),
  initialStateLabel: text('initial_state_label').notNull(),
  /** POC 検証トップ用。シード時の生トークン（本番想定外） */
  rawToken: text('raw_token'),
  /** POC: 申込時 displayName（検証トップ表示・verify 時プロフィール初期値） */
  displayName: text('display_name'),
  createdAt: text('created_at').notNull(),
})
