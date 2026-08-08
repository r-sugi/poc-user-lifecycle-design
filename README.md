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
