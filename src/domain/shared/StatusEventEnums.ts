export const StatusEventType = {
  Activated: 'activated',
  Withdrawn: 'withdrawn',
  WithdrawCancelled: 'withdraw_cancelled',
  Banned: 'banned',
  Unbanned: 'unbanned',
} as const

export type StatusEventTypeValue = (typeof StatusEventType)[keyof typeof StatusEventType]

export const ActorType = {
  User: 'user',
  Admin: 'admin',
  System: 'system',
} as const

export type ActorTypeValue = (typeof ActorType)[keyof typeof ActorType]
