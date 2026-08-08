import type { Context } from 'hono'
import { getCookie, setCookie } from 'hono/cookie'

const FLASH_COOKIE = 'flash'

export function setFlash(c: Context, message: string): void {
  setCookie(c, FLASH_COOKIE, encodeURIComponent(message), {
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
    maxAge: 60,
  })
}

export function consumeFlash(c: Context): string | null {
  const raw = getCookie(c, FLASH_COOKIE)
  if (!raw) return null
  setCookie(c, FLASH_COOKIE, '', { path: '/', maxAge: 0 })
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}
