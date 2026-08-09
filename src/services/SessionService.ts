import type { Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { TTL } from '../config'
import type { SessionKvGateway, SessionPayload } from '../gateways/SessionKvGateway'
import type { TokenIssuingService } from './TokenIssuingService'

const SESSION_TTL_SECONDS = TTL.sessionDays * 24 * 60 * 60
export const USER_SESSION_COOKIE = 'session'
export const ADMIN_SESSION_COOKIE = 'admin_session'

export type IssuedSession = {
  cookieValue: string
  tokenHash: string
  key: string
  subjectId: string
}

type SessionKind = 'user' | 'admin'

/**
 * Cookie 値は生トークンのみ。
 * KV: `session:{kind}:{subjectId}:{tokenHash}` + 逆引き `session-token:{kind}:{tokenHash}` → subjectId
 */
export class SessionService {
  constructor(
    private readonly kv: SessionKvGateway,
    private readonly tokens: TokenIssuingService,
    private readonly appEnv: string = 'local',
  ) {}

  private secure(): boolean {
    return this.appEnv === 'production'
  }

  private cookieOpts(maxAge?: number) {
    return {
      path: '/',
      httpOnly: true,
      sameSite: 'Lax' as const,
      secure: this.secure(),
      ...(maxAge !== undefined ? { maxAge } : {}),
    }
  }

  tokenLookupKey(kind: SessionKind, tokenHash: string): string {
    return `session-token:${kind}:${tokenHash}`
  }

  async issueUserSession(
    userId: string,
    meta: Omit<SessionPayload, 'createdAt'>,
    c?: Context,
  ): Promise<IssuedSession> {
    const issued = await this.issue('user', userId, meta)
    if (c) this.setUserCookie(c, issued.cookieValue)
    return issued
  }

  async issueAdminSession(
    adminId: string,
    meta: Omit<SessionPayload, 'createdAt'>,
    c?: Context,
  ): Promise<IssuedSession> {
    const issued = await this.issue('admin', adminId, meta)
    if (c) this.setAdminCookie(c, issued.cookieValue)
    return issued
  }

  private async issue(
    kind: SessionKind,
    subjectId: string,
    meta: Omit<SessionPayload, 'createdAt'>,
  ): Promise<IssuedSession> {
    const token = await this.tokens.issue()
    const key =
      kind === 'user'
        ? this.kv.userKey(subjectId, token.hashHex)
        : this.kv.adminKey(subjectId, token.hashHex)
    const lookupKey = this.tokenLookupKey(kind, token.hashHex)
    const payload: SessionPayload = { ...meta, createdAt: new Date().toISOString() }
    await this.kv.put(key, payload, SESSION_TTL_SECONDS)
    await this.kv.putRaw(lookupKey, subjectId, SESSION_TTL_SECONDS)
    return { cookieValue: token.raw, tokenHash: token.hashHex, key, subjectId }
  }

  setUserCookie(c: Context, rawToken: string): void {
    setCookie(c, USER_SESSION_COOKIE, rawToken, this.cookieOpts(SESSION_TTL_SECONDS))
  }

  setAdminCookie(c: Context, rawToken: string): void {
    setCookie(c, ADMIN_SESSION_COOKIE, rawToken, this.cookieOpts(SESSION_TTL_SECONDS))
  }

  clearUserCookie(c: Context): void {
    deleteCookie(c, USER_SESSION_COOKIE, { path: '/' })
  }

  clearAdminCookie(c: Context): void {
    deleteCookie(c, ADMIN_SESSION_COOKIE, { path: '/' })
  }

  async resolveFromUserCookie(
    c: Context,
  ): Promise<{ userId: string; key: string; payload: SessionPayload; rawToken: string } | null> {
    const raw = getCookie(c, USER_SESSION_COOKIE)
    if (!raw) return null
    const resolved = await this.resolve('user', raw)
    if (!resolved) return null
    return { userId: resolved.subjectId, key: resolved.key, payload: resolved.payload, rawToken: raw }
  }

  async resolveFromAdminCookie(
    c: Context,
  ): Promise<{ adminId: string; key: string; payload: SessionPayload; rawToken: string } | null> {
    const raw = getCookie(c, ADMIN_SESSION_COOKIE)
    if (!raw) return null
    const resolved = await this.resolve('admin', raw)
    if (!resolved) return null
    return { adminId: resolved.subjectId, key: resolved.key, payload: resolved.payload, rawToken: raw }
  }

  private async resolve(
    kind: SessionKind,
    rawToken: string,
  ): Promise<{ subjectId: string; key: string; payload: SessionPayload } | null> {
    const hash = await this.tokens.hashRaw(rawToken)
    const subjectId = await this.kv.getRaw(this.tokenLookupKey(kind, hash))
    if (!subjectId) return null
    const key = kind === 'user' ? this.kv.userKey(subjectId, hash) : this.kv.adminKey(subjectId, hash)
    const payload = await this.kv.get(key)
    if (!payload) return null
    return { subjectId, key, payload }
  }

  async logoutUser(c: Context): Promise<void> {
    const session = await this.resolveFromUserCookie(c)
    if (session) {
      const hash = await this.tokens.hashRaw(session.rawToken)
      await this.kv.delete(session.key)
      await this.kv.delete(this.tokenLookupKey('user', hash))
    }
    this.clearUserCookie(c)
  }

  async logoutAdmin(c: Context): Promise<void> {
    const session = await this.resolveFromAdminCookie(c)
    if (session) {
      const hash = await this.tokens.hashRaw(session.rawToken)
      await this.kv.delete(session.key)
      await this.kv.delete(this.tokenLookupKey('admin', hash))
    }
    this.clearAdminCookie(c)
  }

  /**
   * セッション本体 + 逆引きキーをまとめて削除（Queue 一括失効でも同じ経路を使う）
   */
  async revokeAllUserSessions(userId: string): Promise<number> {
    const prefix = `session:user:${userId}:`
    const keys = await this.kv.listPrefix(prefix)
    for (const key of keys) {
      const tokenHash = key.slice(prefix.length)
      await this.kv.delete(key)
      if (tokenHash) {
        await this.kv.delete(this.tokenLookupKey('user', tokenHash))
      }
    }
    return keys.length
  }

  async revokeAllAdminSessions(adminId: string): Promise<number> {
    const prefix = `session:admin:${adminId}:`
    const keys = await this.kv.listPrefix(prefix)
    for (const key of keys) {
      const tokenHash = key.slice(prefix.length)
      await this.kv.delete(key)
      if (tokenHash) {
        await this.kv.delete(this.tokenLookupKey('admin', tokenHash))
      }
    }
    return keys.length
  }

  async listUserSessions(userId: string): Promise<Array<{ key: string; payload: SessionPayload }>> {
    const keys = await this.kv.listPrefix(`session:user:${userId}:`)
    const out: Array<{ key: string; payload: SessionPayload }> = []
    for (const key of keys) {
      const payload = await this.kv.get(key)
      if (payload) out.push({ key, payload })
    }
    return out
  }
}
