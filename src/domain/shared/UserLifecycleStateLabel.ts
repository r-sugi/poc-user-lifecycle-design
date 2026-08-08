/** 検証トップ表示用の短い派生ラベル（設計書 §16.2） */
export class UserLifecycleStateLabel {
  private constructor(private readonly value: string) {}

  static of(raw: string): UserLifecycleStateLabel {
    const v = raw.trim()
    if (!v) throw new Error('empty_lifecycle_label')
    return new UserLifecycleStateLabel(v)
  }

  toString(): string {
    return this.value
  }
}
