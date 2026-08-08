import { TOKEN_BYTES } from '../config'
import { Token } from '../domain/shared/Token'

function toHex(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export class TokenIssuingService {
  async issue(): Promise<Token> {
    const rawBytes = crypto.getRandomValues(new Uint8Array(TOKEN_BYTES))
    const raw = toHex(rawBytes)
    const hashHex = await this.hashRaw(raw)
    return Token.fromRawAndHash(raw, hashHex)
  }

  async hashRaw(raw: string): Promise<string> {
    const dig = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))
    return toHex(dig)
  }
}
