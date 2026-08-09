/** SQLite / D1 の UNIQUE 違反のみを検出する。FK / NOT NULL 等の他制約は含めない。 */
export function isUniqueViolation(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false
  const msg = 'message' in e && typeof e.message === 'string' ? e.message : String(e)
  return /UNIQUE constraint failed/i.test(msg)
}
