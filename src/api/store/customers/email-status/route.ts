import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"

const QuerySchema = z.object({
  email: z.string().email(),
})

export type EmailStatus = "new" | "guest" | "registered"

/**
 * GET /store/customers/email-status?email=...
 *
 * Deliberately public and unauthenticated: lets the storefront tell a
 * customer, as soon as they finish typing their email (checkout and
 * /login), whether it's brand new, belongs to a guest-only Customer
 * (has_account:false — past guest-checkout orders waiting to be claimed),
 * or already has a real account (has_account:true) — the 3-state UX
 * requested in the guest->registered conversation.
 *
 * Trade-off, explicit and accepted in that conversation: this makes
 * "does this email have an account" answerable by anyone, which is the
 * accepted cost of the requested UX (same trade-off most storefronts with
 * this pattern make). Not an oversight.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { email } = QuerySchema.parse(req.query)
  const normalized = email.trim().toLowerCase()

  const customerService = req.scope.resolve(Modules.CUSTOMER)
  // $ilike matches case-insensitively at the DB level — cheap (indexed),
  // and resilient to any pre-existing mixed-case rows (see the guest/auth
  // email-casing bug fixed earlier in the same conversation).
  const customers = await customerService.listCustomers(
    { email: { $ilike: normalized } },
    { select: ["id", "has_account"] },
  )

  let status: EmailStatus = "new"
  if (customers.some((c) => c.has_account)) {
    status = "registered"
  } else if (customers.length > 0) {
    status = "guest"
  }

  res.status(200).json({ status })
}
