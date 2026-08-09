# tasklist

実装は本チェックリストの番号順に進める。各項目は完了時に `[x]` へ更新する。コード実装の直前まで、本ファイルと `要件定義書.md` / `設計書.md` を正とする。

---

## フェーズ 1. プロジェクト初期化

- [x] 1.1 `npm create hono@latest` で `cloudflare-workers+vite` テンプレートを一時ディレクトリに生成する
- [x] 1.2 生成物（`src/`, `package.json`, `wrangler.jsonc`, `vite.config.ts` 等）をリポジトリ直下 `/Users/ryo/work/poc-user-lifecycle-design` へ移動し、一時ディレクトリを削除する（サブディレクトリを掘らない）
- [x] 1.3 依存パッケージ（hono, `@cloudflare/vite-plugin`, `vite-ssr-components`, wrangler, vite 等）を最新バージョンへ更新する
- [x] 1.4 `drizzle-orm@0.44.6`, `drizzle-kit@0.31.4`, `better-sqlite3@11.8.1`, `@biomejs/biome@2.2.5` を追加する
- [x] 1.5 `valibot`（最新安定版）と `@hono/valibot-validator` を追加する
- [x] 1.6 Tailwind CSS v4（`@tailwindcss/vite` 等）を追加し、`src/style.css` に `@import "tailwindcss"` を設定する
- [x] 1.7 `vite.config.ts` に `cloudflare()` + `ssrPlugin()` + `@tailwindcss/vite` を構成する
- [x] 1.8 `tsconfig` をプロジェクト構成（jsx: hono 等）に合わせて調整する
- [x] 1.9 `wrangler.jsonc` に D1 バインディング（`DB`）を追加する
- [x] 1.10 KV Namespace（`SESSIONS_KV`）を作成しバインディングを追加する
- [x] 1.11 Queue `session-revocations`（producer/consumer）と DLQ を `wrangler.jsonc` に設定する
- [x] 1.12 `.dev.vars.example` を作成し、`APP_BASE_URL` / `ADMIN_BOOTSTRAP_*` / `SEED_USER_PASSWORD` / `SEED_ADMIN_PASSWORD` / `INTERNAL_BATCH_SECRET` / `APP_ENV` を列挙する
- [x] 1.13 DDD like な空ディレクトリを用意する（`domain/`, `repositories/`, `gateways/`, `services/`, `usecases/`, `presentation/`（含む `schemas/`）, `middleware/`, `lib/`, `db/`）
- [x] 1.14 `npm run dev`（vite dev）で雛形が起動することを確認する
- [x] 1.15 Queues のローカル疎通（投入→consumer）を早期に確認する準備メモを残す（本格確認はフェーズ4）

---

## フェーズ 2. Drizzle スキーマ・マイグレーション

- [x] 2.1 `src/db/schema.ts` に全テーブルを定義する（users, user_profiles, user_identities, signup_verifications, password_resets, email_change_requests, admin_users(+password_hash), user_status_events, user_withdrawals, user_bans, **`seed_user_labels`, `seed_signup_labels`**）
- [x] 2.2 **`sessions` / `admin_sessions` を schema に含めない**ことを確認する
- [x] 2.3 FK・UNIQUE（`(provider, provider_uid)`, `token_hash`, `(user_id, seq)`, `admin_users.email`, `user_profiles.email` 等）を設計書どおりに定義する
- [x] 2.4 `drizzle.config.ts` を作成する
- [x] 2.5 `src/db/client.ts`（`drizzle(env.DB)`）を実装する
- [x] 2.6 `drizzle-kit generate` でマイグレーション SQL を生成する
- [x] 2.7 `wrangler d1 migrations apply <DB> --local` でローカル D1 に適用する
- [x] 2.8 `drizzle-kit push` を使わない運用であることを README 用メモに含められるようにする

---

## フェーズ 3. domain 層

- [x] 3.1 `UserId` ValueObject を実装する
- [x] 3.2 `UserStatus` VO（`active` / `withdrawn` / `banned`）と `canTransitionTo()` を実装する
- [x] 3.3 `User` エンティティ（status / last_seq 操作の不変条件）を実装する
- [x] 3.4 `Email` VO（形式検証）を実装する
- [x] 3.5 `Password` VO（最小長8）を実装する
- [x] 3.6 `Token` VO（生成・hash・照合の型）を実装する
- [x] 3.7 `ReasonCode` VO（withdraw: `no_longer_needed` / `privacy` / `other`、ban: `abuse` / `spam` / `tos_violation`。設計書 §21.2）を実装する
- [x] 3.8 `AdminUser` モデルを実装する
- [x] 3.9 event type / actor_type の列挙を domain 側で定義する
- [x] 3.10 `UserLifecycleStateLabel` VO（表示用短いラベル文字列）を実装する（設計書 §16.2.2）

---

## フェーズ 4. Repository / Gateway / Service / middleware / container

- [x] 4.1 Repository 一式を実装する（User / Profile / Identity / SignupVerification / PasswordReset / EmailChangeRequest / AdminUser / StatusEvent / Withdrawal / Ban / **SeedUserLabel / SeedSignupLabel**）
- [x] 4.2 Repository 内に「単発楽観ロック UPDATE → 影響行数確認 → `db.batch`」の状態遷移書き込みヘルパを閉じ込める
- [x] 4.3 `PasswordHashingService`（PBKDF2-SHA256, 100k, `pbkdf2$iter$salt$hash`）を実装する
- [x] 4.4 `TokenIssuingService`（32byte / SHA-256）を実装する
- [x] 4.5 `MailerGateway`（構造化 JSON の console.log、actionUrl 付き）を実装する
- [x] 4.6 `GoogleAuthMockGateway`（code 埋め込み・復号）を実装する
- [x] 4.7 `SessionKvGateway`（PUT/GET/DELETE/list by prefix、expirationTtl=7日）を実装する
- [x] 4.8 `SessionRevocationQueueGateway`（enqueue）と Worker `queue()` コンシューマ（prefix list → 削除）を実装する
- [x] 4.9 `SessionService`（発行・検証・ログアウト即時削除・Cookie Set/Clear、Secure 分岐）を実装する
- [x] 4.10 `UserStatusTransitionService`（遷移判定 → Repository → 必要時 Queue 投入）を実装する
- [x] 4.10a `CurrentLifecycleStateResolver`（確定ユーザー向け `resolveForConfirmedUser` / 未認証向け `resolveForSignupVerification`。設計書 §16.2.3 カタログ準拠）を実装する
- [x] 4.11 `requireUser` / `requireAdmin` / `requireUserPage` / `requireAdminPage` を実装する（成功パスは KV のみ）
- [x] 4.12 統一エラーハンドラ（`{ error: { code, message } }`）を実装する
- [x] 4.13 `createContainer(c)` を実装する
- [x] 4.14 `config.ts` に TTL 定数を定義する
- [x] 4.15 `lib/flash.ts`（PRG 用）を実装する
- [x] 4.16 `presentation/schemas/` に valibot スキーマの骨格を用意する（signup / login / passwordReset / emailChange / me / withdraw / admin 等、リクエスト単位）
- [x] 4.17 `@hono/valibot-validator`（`vValidator`）の利用方針を Route に適用できるよう、共通の検証エラー→`validation_error` マッピングを用意する
- [ ] 4.18 ローカルで Queue 投入→コンシューマ削除まで疎通確認する
- [x] 4.19 DLQ 設定が wrangler 上存在することを確認する

---

## フェーズ 5. 認証系 UseCase・Route

- [x] 5.1 `SignupUseCase` + API/画面から呼ぶ Route（valibot スキーマで body/form を検証してから UseCase へ渡す）
- [x] 5.2 `VerifySignupUseCase`（方針 A batch + セッション発行）
- [x] 5.3 `ResendSignupVerificationUseCase`
- [x] 5.4 `LoginUseCase`（banned/withdrawn 拒否）
- [x] 5.5 ログアウト Route（即時 KV 削除）。**`POST /auth/refresh` は作らない**
- [x] 5.6 `GoogleLoginUseCase` + `GET /auth/google` / callback（モック）
- [x] 5.7 `RequestPasswordResetUseCase` + `ResetPasswordUseCase`（Queue: password_reset）
- [x] 5.8 `VerifyEmailChangeUseCase`（旧アドレス通知ログ含む）
- [x] 5.9 presentation/api に signup / login / google / passwordReset / emailChange を登録し `index.ts` で mount する
- [x] 5.10 不正入力（メール形式不正・パスワード短すぎ等）が Route で 400 / `validation_error` になることを確認する

---

## フェーズ 6. ユーザー系 UseCase・Route

- [x] 6.1 `GetMeUseCase`（必要に応じ 401 reason 補完: banned/withdrawn）
- [x] 6.2 `UpdateProfileUseCase`（`PATCH /me`、画面なし）
- [x] 6.3 `ChangePasswordUseCase`（Queue: password_change）
- [x] 6.4 `RequestEmailChangeUseCase`
- [x] 6.5 `WithdrawUseCase`（方針 B + Queue: withdraw）
- [x] 6.6 `CancelWithdrawUseCase`（方針 B・**管理者専用**・猶予判定あり）
- [x] 6.7 presentation/api の me（withdraw のみ）を mount する
- [ ] 6.8 curl で /me・退会・パスワード変更の疎通を確認する

---

## フェーズ 7. 管理者系 UseCase・Route・シード

- [x] 7.1 `AdminLoginUseCase` / 管理者ログアウト
- [x] 7.2 `scripts/seed.ts` を実装する（旧 `seedAdmin.ts` 相当を包含。設計書 §21 準拠）
  - [x] 7.2.1 admin **5人**（`admin1@example.com` … `admin5@example.com`、共通パスワード既定 `AdminPass123!` を PBKDF2 hash）
  - [x] 7.2.2 user **16人**（U01〜U16。status / identities / events / withdrawals / bans / 未消費 token のバリエーション。U16 は S3 消費済み verification 対応）
    - active: password のみ / google のみ / password+google
    - active: メール変更申請中（`email_change_requests` 未消費）
    - active: パスワードリセット発行済み（`password_resets` 未消費）
    - withdrawn: 猶予内（退会 3 日前）と猶予超過相当（31 日前・PII 残存＝バッチ対象）
    - banned: `abuse` と `spam` の reason_code 違い
    - active: 退会取消履歴あり / BAN 解除履歴あり
    - verified_at の古新、display_name / email ドメインの多様性
    - U16 `consumed.verify@example.com`: S3 と同一 email・active（verify 成功後の正常系）
  - [x] 7.2.2a 各確定ユーザーについて **`seed_user_labels` に初期状態ラベルを INSERT**（§21.4 の初期状態ラベル列。以降 UPDATE しない）
  - [x] 7.2.3 `signup_verifications` 別枠 **5行**（設計書 §21.5）。原則未認証は `users` に入れない（S3 のみ対応ユーザーあり）
    - S1 `pending.verify@example.com`: 有効・未消費（expires 未来、consumed NULL）
    - S2 `expired.verify@example.com`: 期限切れ・未消費（expires 過去、consumed NULL）
    - S3 `consumed.verify@example.com`: 消費済み（consumed_at あり。対応確定ユーザー U16 あり）
    - S4+S5 `resend.pending@example.com`: 再送ペア（旧行＝無効化相当の消費済み + 現行＝有効・未消費）
  - [x] 7.2.3a 各 signup 行について **`seed_signup_labels` に初期状態ラベルを INSERT**（§21.5）
  - [x] 7.2.4 KV セッションはシードしない（ログインで作成する旨をスクリプトコメントまたは README に注記）
  - [x] 7.2.5 `.dev.vars` の `SEED_*` / 既定パスワードで動作すること。package.json に `seed` スクリプトを用意してよい
- [x] 7.3 ローカルで `scripts/seed.ts` を実行し、管理者ログインおよび代表ユーザー（active / withdrawn / banned）の状態を確認する。あわせて `signup_verifications` 5行が投入され、S1/S2/S4/S5 は `users` に混入せず S3 のみ対応 U16 があることを確認する
- [x] 7.4 `SearchUsersUseCase`（email 検索）
- [x] 7.5 `GetUserDetailUseCase`（profile / identities / KV sessions / events+reasons）
- [x] 7.6 `BanUserUseCase`（方針 B + Queue: ban）
- [x] 7.7 `UnbanUserUseCase`
- [x] 7.7a `CancelWithdrawUseCase` を `POST /admin/users/:id/cancel-withdraw` から呼ぶ
- [x] 7.8 presentation/api/admin.ts を mount する
- [ ] 7.9 curl で BAN → ユーザーログイン不可（ラグ考慮）→ unban → 再ログインを確認する
- [ ] 7.10 シードユーザーで管理画面一覧・詳細（履歴・理由コード・identity 差分）を目視確認する
---

## フェーズ 8. バッチ UseCase

- [ ] 8.1 `PurgeWithdrawnPiiUseCase`（猶予 30 日経過分の profiles/identities 削除）
- [ ] 8.2 `PurgeExpiredTokensUseCase`
- [ ] 8.3 **セッション期限切れ削除は実装しない**ことを確認する
- [ ] 8.4 `POST /internal/batch/:job`（`X-Internal-Batch-Secret` 必須）を実装する
- [ ] 8.5 `wrangler.jsonc` に cron trigger（scheduled）を設定し、`scheduled` ハンドラから両 Job を呼ぶ
- [ ] 8.6 手動トリガーで両バッチが動くことをローカル確認する

---

## フェーズ 9. 画面基盤

- [x] 9.1 `presentation/renderer.tsx`（共通レイアウト、ViteClient/Script、style.css）を整備する
- [ ] 9.2 flash メッセージ表示コンポーネントを共通レイアウトに組み込む
- [ ] 9.3 `statusBadge.tsx` / `eventTimeline.tsx` など共通 UI 部品の骨格を作る
- [ ] 9.4 未ログイン時 / 権限不足時のリダイレクト挙動を確認する
- [ ] 9.5 Tailwind v4 のユーティリティが画面に効くことを確認する
- [x] 9.6 **検証トップ `GET /`**（`presentation/pages/homePage.tsx`）を実装する（**認証不要**）
  - [x] 9.6.1 シード済み確定ユーザーの要約一覧。列: email / **初期状態** / **現在の状態** / **アクション**（active: `POST /dev/login-as` 自動ログイン→`/`、当該セッション行: マイページ＋ログアウト、banned/withdrawn: 無効表示）
  - [x] 9.6.2 **未認証（`signup_verifications`）一覧**（email / created / expires / consumed / **初期状態** / **現在の状態** / **アクション**=有効行は `GET /auth/signup/verify?token=`、無効は理由テキスト）。日時は `formatJst`（JST・分まで）。`seed_signup_labels.raw_token` で生トークンを保持
  - [x] 9.6.3 ユーザー向け・管理者向け画面へのリンク。管理画面と重複しすぎないシンプル UI
  - [x] 9.6.4 シード投入後にトップだけで S1〜S5 および U01〜U16 の差が「現在の状態」で判別できることを目視確認する
  - [x] 9.6.5 操作後の変化例: U01 退会 → 初期状態不変、現在の状態のみ `withdrawn / 退会後30日未満（…）` 等に更新（退会「猶予」＝PII削除待機 30 日）

---

## フェーズ 10. ユーザー向け画面

- [x] 10.1 サインアップ `GET/POST /signup`
- [x] 10.2 サインアップ検証結果 `GET /auth/signup/verify`
- [x] 10.3 ログイン `GET/POST /login`
- [x] 10.4 マイページ `GET /mypage`（status / profile / identities / sessions / 導線）
- [x] 10.5 退会 `POST /mypage/withdraw`（PRG）
- [x] 10.6 （削除）ユーザー向け退会取消は設けない。取消は管理画面 `POST /admin/users/:id` の cancelWithdraw / API `cancel-withdraw`
- [x] 10.7 ログアウト `POST /logout`
- [ ] 10.8 Google モック同意画面 + callback 後 mypage リダイレクト
- [ ] 10.9 パスワードリセット申請 `GET/POST /password/reset-request`
- [ ] 10.10 パスワードリセット実行 `GET/POST /password/reset`
- [ ] 10.11 メール変更申請 `GET/POST /mypage/email-change`
- [ ] 10.12 メール変更検証 `GET /email-change/verify`
- [ ] 10.13 ブラウザで「サインアップ→ログURL検証→ログイン→退会」を通し、取消は管理画面で行うこと
- [x] 10.14 検証トップ `GET /` からユーザー向け導線に入れることを確認する

---

## フェーズ 11. 管理者向け画面

- [x] 11.1 管理者ログイン `GET/POST /admin/login`
- [ ] 11.2 管理者ログアウト `POST /admin/logout`
- [x] 11.3 ユーザー一覧 `GET /admin/users`（email 検索）
- [x] 11.4 ユーザー詳細 `GET /admin/users/:id`（全付随情報・履歴・セッション）
- [x] 11.5 BAN `POST /admin/users/:id/ban`（理由入力）
- [x] 11.6 BAN 解除 `POST /admin/users/:id/unban`
- [x] 11.6a 退会取消 `POST /admin/users/:id/cancel-withdraw`（詳細画面フォーム含む）
- [ ] 11.7 ブラウザで「BAN→ユーザーログイン不可確認→解除→再ログイン」および「退会→管理者取消→再ログイン」を通す（Queue ラグを考慮）
- [x] 11.8 検証トップ `GET /` から管理者向け導線に入れること、および未認証一覧が管理者ユーザー一覧と混ざらないことを確認する

---

## フェーズ 12. Biome

- [ ] 12.1 `biome.json` をプロジェクトに合わせて設定する
- [ ] 12.2 package.json に `lint` / `format` スクリプトを追加する
- [ ] 12.3 リポジトリ全体に Biome check / format を適用し、エラーを解消する

---

## フェーズ 13. README

- [ ] 13.1 ローカル起動手順（依存インストール、`.dev.vars`、D1 migrate、`scripts/seed.ts`（admin 5 / user 16 / signup_verifications 5行）、`npm run dev`）を書く
- [ ] 13.1a シード一覧の要約（共通パスワード、代表 email、未認証は users 未作成、KV セッションはログインで作る）を README に載せる
- [ ] 13.1b 検証トップ `GET /` が POC 入口である旨を README に書く
- [ ] 13.2 KV / Queue のセットアップ手順を書く
- [ ] 13.3 メールはログの `actionUrl` を使う旨を明記する
- [ ] 13.4 ブラウザ確認シナリオを書く:
  - ユーザー: サインアップ→検証→ログイン→退会
  - 管理者: 退会取消（猶予内）→ユーザー再ログイン
  - ユーザー: パスワードリセット
  - ユーザー: メールアドレス変更
  - 管理者: BAN→ログイン不可→BAN解除→再ログイン可能
- [ ] 13.5 主要 API の curl 例（疎通用）を付録として書く
- [ ] 13.6 `POST /auth/refresh` が無いこと、セッション 7 日固定であることを注記する

---

## フェーズ 14. シナリオ一括確認・最終レビュー

- [ ] 14.1 ユーザー側ライフサイクルを画面のみで最初から最後まで実施する
- [ ] 14.2 管理者側 BAN / 解除シナリオを画面のみで実施する
- [ ] 14.3 Google モックログイン（新規・既存 email 紐付け）を確認する
- [ ] 14.4 パスワード変更・リセット後に他セッションが失効すること（～60秒以内）を確認する
- [ ] 14.5 バッチ（PII / トークン）を手動トリガーで確認する
- [ ] 14.6 未認証 S1/S2/S4/S5 が `users` に現れず、消費済み S3 のみ対応確定ユーザー（U16）が存在することを DB および検証トップ一覧で確認する
- [ ] 14.6a 検証トップで S1〜S5（有効 / 期限切れ / 消費済み・users作成済 / 再送ペア）の差が「現在の状態」で見えることを確認する
- [ ] 14.6b 検証トップで確定ユーザーの「初期状態」が操作後も不変、「現在の状態」だけ変わることを確認する（例: U01 退会）
- [ ] 14.7 `sessions` テーブルが D1 に存在しないことを確認する
- [ ] 14.8 要件定義書の検証成功定義を満たしたことをチェックし、差分があれば設計書/tasklist を更新する

---

## 進捗メモ

| フェーズ | 状態 | 備考 |
|---|---|---|
| 1 初期化 | 完了 | テンプレ展開・依存・D1/KV/Queue・Tailwind・Biome |
| 2 スキーマ | 完了 | schema + マイグレーション local 適用済み（seed_*labels含む） |
| 3 domain | 完了 | VO/Entity + UserLifecycleStateLabel |
| 4 基盤 | 完了寄 | Repository/middleware/Session Cookie。Queue consumer 実装 |
| 5 認証 | 完了寄 | API UseCase+Route |
| 6 ユーザー | 完了寄 | /me・退会系 |
| 7 管理者 | 完了寄 | seed・admin API・画面 |
| 8 バッチ | 未着手 | |
| 9 画面基盤 | 進行中 | 検証トップ実装済み |
| 10 ユーザー画面 | 進行中 | signup/login/mypage |
| 11 管理者画面 | 進行中 | login/list/detail |
| 12 Biome | 未着手 | |
| 13 README | 未着手 | |
| 14 一括確認 | 未着手 | |
