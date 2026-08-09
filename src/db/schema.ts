import {
  foreignKey,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'

export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    status: text('status').notNull(), // active | withdrawn | banned
    lastSeq: integer('last_seq').notNull().default(0),
    /** アカウント確定時刻。password: メール検証完了 / google: 初回ログイン成立（callback） */
    verifiedAt: text('verified_at').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [index('users_status_idx').on(t.status)],
)

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
  (t) => [
    uniqueIndex('user_identities_provider_uid_unique').on(t.provider, t.providerUid),
    index('user_identities_user_id_idx').on(t.userId),
  ],
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
  (t) => [
    uniqueIndex('signup_verifications_token_hash_unique').on(t.tokenHash),
    index('signup_verifications_email_idx').on(t.email),
  ],
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
  (t) => [
    uniqueIndex('password_resets_token_hash_unique').on(t.tokenHash),
    index('password_resets_user_id_idx').on(t.userId),
  ],
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
  (t) => [
    uniqueIndex('email_change_requests_token_hash_unique').on(t.tokenHash),
    index('email_change_requests_user_id_idx').on(t.userId),
  ],
)

export const adminUsers = sqliteTable(
  'admin_users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    createdAt: text('created_at').notNull(),
    /** 退任等でログインを止める。物理削除しない */
    disabledAt: text('disabled_at'),
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
    /** admin 操作時は admin_users.id。「誰が」は共通軸 */
    actorId: text('actor_id'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [uniqueIndex('user_status_events_user_seq_unique').on(t.userId, t.seq)],
)

/** 退会フォーム固有。PK = events の (user_id, seq) */
export const userWithdrawals = sqliteTable(
  'user_withdrawals',
  {
    userId: text('user_id').notNull(),
    seq: integer('seq').notNull(),
    reasonCode: text('reason_code').notNull(),
    reasonText: text('reason_text'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.seq] }),
    foreignKey({
      columns: [t.userId, t.seq],
      foreignColumns: [userStatusEvents.userId, userStatusEvents.seq],
    }),
  ],
)

/** BAN フォーム固有。「誰が」は events.actor_id */
export const userBans = sqliteTable(
  'user_bans',
  {
    userId: text('user_id').notNull(),
    seq: integer('seq').notNull(),
    reasonCode: text('reason_code').notNull(),
    reasonText: text('reason_text'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.seq] }),
    foreignKey({
      columns: [t.userId, t.seq],
      foreignColumns: [userStatusEvents.userId, userStatusEvents.seq],
    }),
  ],
)

/** BAN 解除 stub（将来のフォーム列用）。操作者は events.actor_id */
export const userUnbans = sqliteTable(
  'user_unbans',
  {
    userId: text('user_id').notNull(),
    seq: integer('seq').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.seq] }),
    foreignKey({
      columns: [t.userId, t.seq],
      foreignColumns: [userStatusEvents.userId, userStatusEvents.seq],
    }),
  ],
)

/** 管理者による不可逆操作の監査（status 遷移とは独立） */
export const adminAuditLogs = sqliteTable('admin_audit_logs', {
  id: text('id').primaryKey(),
  adminUserId: text('admin_user_id')
    .notNull()
    .references(() => adminUsers.id),
  action: text('action').notNull(), // pii_purge | pii_anonymize
  targetUserId: text('target_user_id')
    .notNull()
    .references(() => users.id),
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
