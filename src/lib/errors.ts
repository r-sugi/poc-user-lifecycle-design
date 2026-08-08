export class AppError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly httpStatus = 400,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export function isAppError(err: unknown): err is AppError {
  return (
    err instanceof AppError ||
    (typeof err === 'object' &&
      err !== null &&
      'name' in err &&
      (err as { name: string }).name === 'AppError' &&
      'code' in err)
  )
}

export function errorJson(err: unknown): {
  status: number
  body: { error: { code: string; message: string } }
} {
  if (isAppError(err)) {
    const e = err as AppError
    return {
      status: e.httpStatus ?? 400,
      body: { error: { code: e.code, message: e.message } },
    }
  }
  console.error(err)
  return {
    status: 500,
    body: { error: { code: 'internal_error', message: 'Internal Server Error' } },
  }
}
