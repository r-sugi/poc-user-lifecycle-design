export type MailLogPayload = {
  to: string
  subject: string
  actionUrl: string
  kind: string
  body?: string
}

/** 実送信なし。構造化 JSON を console.log */
export class MailerGateway {
  constructor(private readonly appBaseUrl: string) {}

  getBaseUrl(): string {
    return this.appBaseUrl.replace(/\/$/, '')
  }

  async send(payload: MailLogPayload): Promise<void> {
    console.log(
      JSON.stringify({
        type: 'mail_mock',
        ...payload,
        loggedAt: new Date().toISOString(),
      }),
    )
  }
}
