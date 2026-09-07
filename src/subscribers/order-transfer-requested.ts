import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import {
  ChangeActionType,
  ContainerRegistrationKeys,
  Modules,
  OrderWorkflowEvents,
} from "@medusajs/framework/utils"

type OrderTransferRequestedEventData = {
  id: string
  order_change_id: string
}

/**
 * Sends the "confirm this order belongs to your account" email once a
 * transfer has been requested (guest checkout -> logged-in account, or an
 * admin-initiated transfer). Medusa only creates the order_change/action
 * pair and emits this event - it does not send anything on its own.
 *
 * The confirmation token isn't in the event payload: it lives on the
 * "transfer_customer" action created by requestOrderTransferWorkflow, so we
 * look it up via the order_change_id before building the storefront link
 * consumed by POST /store/orders/:id/transfer/accept.
 */
export default async function orderTransferRequestedHandler({
  event: { data },
  container,
}: SubscriberArgs<OrderTransferRequestedEventData>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const notificationModuleService = container.resolve(Modules.NOTIFICATION)
  const customerModuleService = container.resolve(Modules.CUSTOMER)

  const {
    data: [orderChange],
  } = await query.graph({
    entity: "order_change",
    fields: ["id", "order_id", "actions.action", "actions.reference_id", "actions.details"],
    filters: { id: data.order_change_id },
  })

  const transferAction = orderChange?.actions?.find(
    (action: { action?: string }) => action.action === ChangeActionType.TRANSFER_CUSTOMER
  )

  const token = transferAction?.details?.token as string | undefined
  const customerId = transferAction?.reference_id as string | undefined

  if (!token || !customerId) {
    logger.warn(
      `order-transfer-requested subscriber: no transfer token/customer found for order ${data.id} ` +
        `(order_change ${data.order_change_id}), skipping email.`
    )
    return
  }

  const storefrontUrl = process.env.STOREFRONT_URL

  if (!storefrontUrl) {
    logger.warn(
      `order-transfer-requested subscriber: STOREFRONT_URL is not set, cannot build the ` +
        `transfer confirmation link for order ${data.id}.`
    )
    return
  }

  const customer = await customerModuleService.retrieveCustomer(customerId)

  const confirmationUrl = new URL("/order/transfer", storefrontUrl)
  confirmationUrl.searchParams.set("order_id", data.id)
  confirmationUrl.searchParams.set("token", token)
  confirmationUrl.searchParams.set("action", "accept")

  try {
    await notificationModuleService.createNotifications({
      to: customer.email,
      channel: "email",
      template: "order-transfer-requested",
      trigger_type: OrderWorkflowEvents.TRANSFER_REQUESTED,
      resource_id: data.id,
      data: {
        url: confirmationUrl.toString(),
        order_id: data.id,
      },
    })
  } catch (error) {
    logger.error(
      `order-transfer-requested subscriber: failed to send confirmation email for order ${data.id}`,
      error
    )
  }
}

export const config: SubscriberConfig = {
  event: OrderWorkflowEvents.TRANSFER_REQUESTED,
  context: {
    subscriberId: "order-transfer-requested-handler",
  },
}
