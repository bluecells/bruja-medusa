import type { CustomerDTO, CustomerUpdatableFields } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import {
  createStep,
  createWorkflow,
  StepResponse,
  transform,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { createCustomerAccountWorkflow, setAuthAppMetadataStep } from "@medusajs/medusa/core-flows"

export type ConvertGuestToCustomerWorkflowInput = {
  /** ID of the auth identity behind the request — issued by
   * /auth/customer/emailpass/register (or a login token, though the route
   * rejects those before this workflow runs). Never a client-supplied id:
   * it comes from req.auth_context, which the framework only populates
   * after verifying the request's signed JWT. */
  authIdentityId: string
  customerData: {
    email: string
    first_name?: string | null
    last_name?: string | null
    phone?: string | null
  }
}

const findGuestCustomerByEmailStepId = "find-guest-customer-by-email"

/**
 * Looks up an existing *guest* customer (has_account: false) for this
 * email — the same {email, has_account} filter Medusa's own
 * validateCustomerAccountCreation and findOrCreateCustomerStep already use
 * elsewhere (see node_modules/@medusajs/core-flows/dist/customer/steps/
 * validate-customer-account-creation.js and dist/cart/steps/
 * find-or-create-customer.js). Scoped to has_account:false so a real
 * registered customer for this email can never be matched here.
 */
const findGuestCustomerByEmailStep = createStep(
  findGuestCustomerByEmailStepId,
  async (email: string, { container }) => {
    const customerService = container.resolve(Modules.CUSTOMER)
    const [guest] = await customerService.listCustomers({
      email,
      has_account: false,
    })
    return new StepResponse(guest ?? null)
  },
)

const promoteGuestCustomerStepId = "promote-guest-customer"

/**
 * Flips an existing guest Customer row to has_account: true *in place* —
 * same id, same addresses/metadata, same orders (Order.customer_id is a
 * plain column, not a join table — see node_modules/@medusajs/order/dist/
 * models/order.js — so nothing needs transferring).
 *
 * This is its own step rather than core-flows' updateCustomersWorkflow
 * because that workflow's compensation (dist/customer/steps/
 * update-customers.js) only restores first_name/last_name/email/phone/
 * metadata on rollback — not has_account. If setAuthAppMetadataStep below
 * failed right after, rolling back through that step would leave
 * has_account stuck at true with no auth identity actually linked to it.
 * This step's own compensation restores has_account itself, so a failure
 * anywhere later in this workflow leaves the guest customer exactly as it
 * was found.
 */
const promoteGuestCustomerStep = createStep(
  promoteGuestCustomerStepId,
  async (
    input: {
      customerId: string
      first_name?: string | null
      last_name?: string | null
      phone?: string | null
    },
    { container },
  ) => {
    const customerService = container.resolve(Modules.CUSTOMER)
    const customer = await customerService.updateCustomers(input.customerId, {
      // has_account isn't part of CustomerUpdatableFields — that type is
      // the *public* update-customer contract (Admin/Store update-customer
      // routes never let a caller flip it). It's a plain mutable column on
      // the model (node_modules/@medusajs/customer/dist/models/
      // customer.js), and this is the one place meant to set it.
      has_account: true,
      first_name: input.first_name ?? undefined,
      last_name: input.last_name ?? undefined,
      phone: input.phone ?? undefined,
    } as CustomerUpdatableFields)
    return new StepResponse(customer, input.customerId)
  },
  async (customerId, { container }) => {
    if (!customerId) return
    const customerService = container.resolve(Modules.CUSTOMER)
    await customerService.updateCustomers(customerId, {
      has_account: false,
    } as CustomerUpdatableFields)
  },
)

export const convertGuestToCustomerWorkflowId = "convert-guest-to-customer"

/**
 * Registers a customer account for an email that may already have a guest
 * Customer row (has_account: false) attached to past guest-checkout
 * orders. Unlike the native createCustomerAccountWorkflow — which always
 * inserts a brand new Customer row and lets it coexist with the guest one
 * via the (email, has_account) unique index (see node_modules/
 * @medusajs/customer/dist/migrations/Migration20240524123112.js) — this
 * workflow promotes that same guest row in place when one exists, so the
 * customer keeps their id, addresses, metadata, and order history with
 * nothing to transfer.
 *
 * Everything except the guest lookup/promotion above is native, reused
 * as-is:
 * - setAuthAppMetadataStep: the exact step createCustomerAccountWorkflow
 *   itself uses to link an auth identity to a customer id.
 * - createCustomerAccountWorkflow: the untouched native registration
 *   workflow, used as-is when there's no guest row to promote — it runs
 *   its own validateCustomerAccountCreation check, so a genuinely new
 *   email goes through the exact same path POST /store/customers uses
 *   today.
 */
export const convertGuestToCustomerWorkflow = createWorkflow(
  convertGuestToCustomerWorkflowId,
  (input: ConvertGuestToCustomerWorkflowInput) => {
    const guestCustomer = findGuestCustomerByEmailStep(input.customerData.email)

    const hasGuestCustomer = transform({ guestCustomer }, ({ guestCustomer }) => !!guestCustomer)

    const promoted = when("promote-guest-customer", { hasGuestCustomer }, ({ hasGuestCustomer }) => hasGuestCustomer).then(
      () => {
        const promoteInput = transform({ input, guestCustomer }, ({ input, guestCustomer }) => ({
          customerId: guestCustomer!.id,
          first_name: input.customerData.first_name,
          last_name: input.customerData.last_name,
          phone: input.customerData.phone,
        }))
        const customer = promoteGuestCustomerStep(promoteInput)

        setAuthAppMetadataStep({
          authIdentityId: input.authIdentityId,
          actorType: "customer",
          value: customer.id,
        })

        return customer
      },
    )

    const created = when(
      "create-new-customer",
      { hasGuestCustomer },
      ({ hasGuestCustomer }) => !hasGuestCustomer,
    ).then(() => {
      return createCustomerAccountWorkflow.runAsStep({
        input: {
          authIdentityId: input.authIdentityId,
          customerData: input.customerData,
        },
      })
    })

    const customer = transform({ promoted, created }, ({ promoted, created }) => (promoted ?? created) as CustomerDTO)

    return new WorkflowResponse(customer)
  },
)
