export type SessionRevocationMessage = {
  userId: string
  reason: 'ban' | 'withdraw' | 'password_change' | 'password_reset'
}

export class SessionRevocationQueueGateway {
  constructor(private readonly queue: Queue<SessionRevocationMessage>) {}

  async enqueue(message: SessionRevocationMessage): Promise<void> {
    await this.queue.send(message)
  }
}
