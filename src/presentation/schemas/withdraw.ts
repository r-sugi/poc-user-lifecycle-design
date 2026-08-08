import * as v from 'valibot'

export const withdrawSchema = v.object({
  reasonCode: v.picklist(['no_longer_needed', 'privacy', 'other']),
  reasonText: v.optional(v.string()),
})
