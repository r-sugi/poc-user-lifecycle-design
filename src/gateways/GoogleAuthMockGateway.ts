export type GoogleMockProfile = {
  email: string
  name: string
  sub: string
}

/**
 * 実 Google 通信なし。クエリのダミープロフィールを code に埋めて callback へ渡す。
 */
export class GoogleAuthMockGateway {
  encodeCode(profile: GoogleMockProfile): string {
    return btoa(JSON.stringify(profile))
  }

  decodeCode(code: string): GoogleMockProfile {
    const parsed = JSON.parse(atob(code)) as GoogleMockProfile
    if (!parsed.email || !parsed.sub) throw new Error('invalid_google_mock_code')
    return parsed
  }
}
