import * as v from 'valibot'
import { emailField, passwordField } from './signup'

export const loginSchema = v.object({
  email: emailField,
  password: passwordField,
})
