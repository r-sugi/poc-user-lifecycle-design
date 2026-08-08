import { PBKDF2_ITERATIONS } from '../config'

function toHex(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

/**
 * 形式: pbkdf2$iter$saltHex$hashHex
 */
export class PasswordHashingService {
  async hash(plain: string, iterations = PBKDF2_ITERATIONS): Promise<string> {
    const salt = crypto.getRandomValues(new Uint8Array(16))
    const key = await this.derive(plain, salt, iterations)
    return `pbkdf2$${iterations}$${toHex(salt)}$${toHex(key)}`
  }

  async verify(plain: string, encoded: string): Promise<boolean> {
    const parts = encoded.split('$')
    if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false
    const iterations = Number(parts[1])
    const salt = fromHex(parts[2])
    const expected = parts[3]
    const actual = toHex(await this.derive(plain, salt, iterations))
    return actual === expected
  }

  private async derive(plain: string, salt: Uint8Array, iterations: number): Promise<ArrayBuffer> {
    const enc = new TextEncoder()
    const baseKey = await crypto.subtle.importKey('raw', enc.encode(plain), 'PBKDF2', false, [
      'deriveBits',
    ])
    return crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        // WebCrypto BufferSource typing varies by lib; cast keeps workers+node checkable
        salt: salt as BufferSource,
        iterations,
        hash: 'SHA-256',
      },
      baseKey,
      256,
    )
  }
}
