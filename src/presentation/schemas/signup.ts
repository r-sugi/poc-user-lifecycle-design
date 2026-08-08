import * as v from 'valibot'
import { PASSWORD_MIN_LENGTH } from '../../config'

export const emailField = v.pipe(v.string(), v.email('invalid email'))
export const passwordField = v.pipe(
  v.string(),
  v.minLength(PASSWORD_MIN_LENGTH, `password min ${PASSWORD_MIN_LENGTH}`),
)

export const signupSchema = v.object({
  email: emailField,
  password: passwordField,
  displayName: v.pipe(v.string(), v.minLength(1)),
})

export const loginSchema = v.object({
  email: emailField,
  password: v.string(),
})

export const signupResendSchema = v.object({
  email: emailField,
})

export const signupVerifySchema = v.object({
  token: v.pipe(v.string(), v.minLength(1)),
})
