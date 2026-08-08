import * as v from 'valibot'
import { emailField, passwordField } from './signup'

export const adminLoginSchema = v.object({
  email: emailField,
  password: passwordField,
})

export const banSchema = v.object({
  reasonCode: v.picklist(['abuse', 'spam', 'tos_violation']),
  reasonText: v.optional(v.string()),
})
