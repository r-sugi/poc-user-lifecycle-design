export type SessionPayload = {
  userAgent: string
  ipAddress: string
  createdAt: string
}

export class SessionKvGateway {
  constructor(private readonly kv: KVNamespace) {}

  userKey(userId: string, tokenHash: string): string {
    return `session:user:${userId}:${tokenHash}`
  }

  adminKey(adminId: string, tokenHash: string): string {
    return `session:admin:${adminId}:${tokenHash}`
  }

  async put(key: string, value: SessionPayload, expirationTtlSeconds: number): Promise<void> {
    await this.kv.put(key, JSON.stringify(value), { expirationTtl: expirationTtlSeconds })
  }

  async putRaw(key: string, value: string, expirationTtlSeconds: number): Promise<void> {
    await this.kv.put(key, value, { expirationTtl: expirationTtlSeconds })
  }

  async get(key: string): Promise<SessionPayload | null> {
    const raw = await this.kv.get(key)
    if (!raw) return null
    return JSON.parse(raw) as SessionPayload
  }

  async getRaw(key: string): Promise<string | null> {
    return this.kv.get(key)
  }

  async delete(key: string): Promise<void> {
    await this.kv.delete(key)
  }

  async listPrefix(prefix: string): Promise<string[]> {
    const keys: string[] = []
    let cursor: string | undefined
    do {
      const page = await this.kv.list({ prefix, cursor })
      for (const k of page.keys) keys.push(k.name)
      cursor = page.list_complete ? undefined : page.cursor
    } while (cursor)
    return keys
  }

  async deleteByPrefix(prefix: string): Promise<number> {
    const keys = await this.listPrefix(prefix)
    await Promise.all(keys.map((k) => this.kv.delete(k)))
    return keys.length
  }
}
