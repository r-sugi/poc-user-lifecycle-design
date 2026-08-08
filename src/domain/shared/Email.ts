const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export class Email {
  private constructor(private readonly value: string) {}

  static create(raw: string): Email {
    const v = raw.trim().toLowerCase()
    if (!EMAIL_RE.test(v)) throw new Error('invalid_email')
    return new Email(v)
  }

  toString(): string {
    return this.value
  }
}
