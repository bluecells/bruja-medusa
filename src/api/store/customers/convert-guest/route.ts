import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { convertGuestToCustomerWorkflow } from "../../../../workflows/convert-guest-to-customer"
import type { StoreConvertGuestToCustomerType } from "./validators"

/**
 * POST /store/customers/convert-guest
 *
 * Registers a customer account, promoting an existing guest Customer
 * (has_account: false) in place for this email when one exists, instead
 * of creating a second Customer row alongside it — see
 * ../../../../../workflows/convert-guest-to-customer.ts for why and how.
 *
 * Security: this route requires the exact same proof of email ownership
 * as the native POST /store/customers route it complements — a signed
 * registration/session JWT verified by the `authenticate` middleware (see
 * ../../../middlewares.ts). The email and every other field come from
 * req.auth_context / req.validatedBody, never trusted from an
 * unauthenticated client-supplied id, so a request can only ever convert
 * the guest Customer matching the identity it actually authenticated as.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest<StoreConvertGuestToCustomerType>,
  res: MedusaResponse,
) => {
  // Mirrors the guard in Medusa's own POST /store/customers route
  // (node_modules/@medusajs/medusa/dist/api/store/customers/route.js):
  // a request already authenticated as a real customer has nothing to
  // convert — the storefront's login-fallback flow should have stopped
  // before ever reaching this route in that case.
  if (req.auth_context.actor_id) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Request already authenticated as a customer.")
  }

  const { result } = await convertGuestToCustomerWorkflow(req.scope).run({
    input: {
      authIdentityId: req.auth_context.auth_identity_id,
      customerData: req.validatedBody,
    },
  })

  res.status(200).json({ customer: result })
}
