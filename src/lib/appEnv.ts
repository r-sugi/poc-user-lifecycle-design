/** ローカル POC の検証用機能が有効か（本番では無効） */
export function isDevLoginEnabled(appEnv: string | undefined): boolean {
  const env = (appEnv ?? 'local').toLowerCase()
  return env !== 'production'
}
