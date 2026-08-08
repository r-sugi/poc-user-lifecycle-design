export class Token {
  private constructor(
    readonly raw: string,
    readonly hashHex: string,
  ) {}

  static fromRawAndHash(raw: string, hashHex: string): Token {
    if (!raw || !hashHex) throw new Error('invalid_token')
    return new Token(raw, hashHex)
  }

  matchesHash(otherHashHex: string): boolean {
    return this.hashHex === otherHashHex
  }
}
