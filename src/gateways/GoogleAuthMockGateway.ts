export type GoogleMockProfile = {
  email: string
  name: string
  sub: string
  /** IdP の email_verified。連携条件はこのフラグが true のときのみ */
  emailVerified: boolean
}

/**
 * 実 Google 通信なし。クエリのダミープロフィールを code に埋めて callback へ渡す。
 */
export class GoogleAuthMockGateway {
  encodeCode(profile: Omit<GoogleMockProfile, 'emailVerified'> & { emailVerified?: boolean }): string {
    const full: GoogleMockProfile = {
      ...profile,
      emailVerified: profile.emailVerified ?? true,
    }
    return btoa(JSON.stringify(full))
  }

  decodeCode(code: string): GoogleMockProfile {
    const parsed = JSON.parse(atob(code)) as Partial<GoogleMockProfile>
    if (!parsed.email || !parsed.sub) throw new Error('invalid_google_mock_code')
    return {
      email: parsed.email,
      name: parsed.name ?? parsed.email,
      sub: parsed.sub,
      emailVerified: parsed.emailVerified !== false,
    }
  }
}
