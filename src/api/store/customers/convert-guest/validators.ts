import { z } from "@medusajs/framework/zod"

// Mirrors @medusajs/medusa's own StoreCreateCustomer validator (dist/api/
// store/customers/validators.js) minus the fields that route doesn't need
// here (company_name, metadata) — kept intentionally narrow since this
// body only ever feeds the promoted-or-created customer's profile fields.
export const StoreConvertGuestToCustomer = z.object({
  email: z.string().email(),
  first_name: z.string().nullish(),
  last_name: z.string().nullish(),
  phone: z.string().nullish(),
})

export type StoreConvertGuestToCustomerType = z.infer<typeof StoreConvertGuestToCustomer>
