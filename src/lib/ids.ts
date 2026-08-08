export function newId(prefix?: string): string {
  const id = crypto.randomUUID()
  return prefix ? `${prefix}-${id}` : id
}

export function hoursFromNow(hours: number, from = new Date()): string {
  return new Date(from.getTime() + hours * 60 * 60 * 1000).toISOString()
}

export function daysAgo(days: number, from = new Date()): string {
  return new Date(from.getTime() - days * 24 * 60 * 60 * 1000).toISOString()
}
