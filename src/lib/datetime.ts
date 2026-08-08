import { ja } from 'date-fns/locale'
import { formatInTimeZone } from 'date-fns-tz'

const JST = 'Asia/Tokyo'
/** 例: 2026/08/08 14:30（秒なし・JST 固定） */
const JST_FORMAT = 'yyyy/MM/dd HH:mm'

/** ISO 等を Asia/Tokyo の分までの文字列に。null/不正は `—` */
export function formatJst(value: string | Date | null | undefined): string {
  if (value == null || value === '') return '—'
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return '—'
  return formatInTimeZone(date, JST, JST_FORMAT, { locale: ja })
}
