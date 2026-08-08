import { PASSWORD_MIN_LENGTH } from '../../config'

export class Password {
  private constructor(private readonly value: string) {}

  static create(raw: string): Password {
    if (raw.length < PASSWORD_MIN_LENGTH) throw new Error('password_too_short')
    return new Password(raw)
  }

  toString(): string {
    return this.value
  }
}
