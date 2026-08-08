import * as v from 'valibot'
import { emailField, passwordField } from './signup'

export const requestEmailChangeSchema = v.object({
  newEmail: emailField,
})

export const verifyEmailChangeSchema = v.object({
  token: v.pipe(v.string(), v.minLength(1)),
})

export const changePasswordSchema = v.object({
  currentPassword: v.string(),
  newPassword: passwordField,
})
