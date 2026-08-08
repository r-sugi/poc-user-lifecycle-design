import * as v from 'valibot'

export const updateProfileSchema = v.object({
  displayName: v.pipe(v.string(), v.minLength(1)),
})

export const changePasswordSchema = v.object({
  currentPassword: v.string(),
  newPassword: v.pipe(v.string(), v.minLength(8)),
})
