/** TTL / 運用定数（設計書） */
export const TTL = {
  signupVerificationHours: 24,
  passwordResetHours: 1,
  emailChangeHours: 24,
  sessionDays: 7,
  withdrawGraceDays: 30,
} as const

export const PASSWORD_MIN_LENGTH = 8
export const PBKDF2_ITERATIONS = 600_000
export const TOKEN_BYTES = 32
