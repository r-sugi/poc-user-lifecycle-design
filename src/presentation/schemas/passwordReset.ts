import * as v from 'valibot'
import { emailField, passwordField } from './signup'

export const passwordResetRequestSchema = v.object({
  email: emailField,
})

export const passwordResetSchema = v.object({
  token: v.pipe(v.string(), v.minLength(1)),
  password: passwordField,
})
