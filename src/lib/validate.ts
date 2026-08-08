import type { GenericSchema } from 'valibot'
import * as v from 'valibot'
import { AppError } from './errors'

export function parseOrThrow<TSchema extends GenericSchema>(
  schema: TSchema,
  data: unknown,
): v.InferOutput<TSchema> {
  const result = v.safeParse(schema, data)
  if (!result.success) {
    throw new AppError(
      'validation_error',
      result.issues.map((i) => i.message).join('; '),
      400,
    )
  }
  return result.output
}
