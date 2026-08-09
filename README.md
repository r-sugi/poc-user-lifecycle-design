# User Lifecycle POC

Cloudflare Workers + Hono + D1 + KV + Queues によるユーザー status ライフサイクル検証用プロジェクト。

詳細仕様は `要件定義書.md` / `設計書.md` / `tasklist.md` を参照。

## ローカル起動

```bash
cp .dev.vars.example .dev.vars
npm install
npm run db:migrate:local
npm run seed
npm run dev                  # http://localhost:5173
```

- 検証トップ `GET /`: 確定ユーザー / 未認証一覧に **初期状態**・**現在の状態** 列
- シード: admin 5 / user 16 / signup_verifications 5 / `seed_*_labels`
- 共通パスワード: ユーザー `Password123!` / 管理者 `AdminPass123!`
- DB `DB` / セッション KV `SESSIONS_KV` / Queue `SESSION_REVOCATIONS`（DLQ あり）
- メールは console.log のみ、Google はモック

### 再シード時の注意

- PBKDF2 反復回数は **600,000**（新規 hash 時）。保存済み hash は文字列中の反復回数で照合するため、旧 100,000 回の hash でもログイン自体は可能。マイグレーション後はシード整合（A5 の `disabled_at` 等）のため `npm run seed` の再実行を推奨。
- 退会取消は**管理者のみ**（`POST /admin/users/:id/cancel-withdraw`）。`withdrawn` ユーザーはログイン不可。
- A5（`admin5@example.com`）は `disabled_at` 付きでシードされ、ログインできない。
