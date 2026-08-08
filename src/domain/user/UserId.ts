export class UserId {
  private constructor(private readonly value: string) {}

  static create(raw: string): UserId {
    const v = raw.trim()
    if (!v) throw new Error('UserId is required')
    return new UserId(v)
  }

  toString(): string {
    return this.value
  }

  equals(other: UserId): boolean {
    return this.value === other.value
  }
}
