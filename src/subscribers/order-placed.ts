import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import {
  ContainerRegistrationKeys,
  Modules,
  OrderWorkflowEvents,
} from "@medusajs/framework/utils"

type OrderPlacedEventData = {
  id: string
}

/**
 * Sends the order confirmation email. Medusa v2 doesn't send one on its
 * own - order.placed only fires the event, nothing subscribes to it by
 * default, so without this the customer never heard back after paying.
 */
export default async function orderPlacedHandler({
  event: { data },
  container,
}: SubscriberArgs<OrderPlacedEventData>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const notificationModuleService = container.resolve(Modules.NOTIFICATION)

  const {
    data: [order],
  } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "email",
      "currency_code",
      "item_total",
      "shipping_total",
      "total",
      "items.title",
      "items.quantity",
      "items.unit_price",
      "shipping_address.first_name",
      "shipping_address.last_name",
      "shipping_address.address_1",
      "shipping_address.postal_code",
      "shipping_address.city",
      "shipping_address.country_code",
    ],
    filters: { id: data.id },
  })

  if (!order?.email) {
    logger.warn(
      `order-placed subscriber: order ${data.id} has no email, skipping confirmation.`
    )
    return
  }

  try {
    await notificationModuleService.createNotifications({
      to: order.email,
      channel: "email",
      template: "order-placed",
      trigger_type: OrderWorkflowEvents.PLACED,
      resource_id: order.id,
      data: {
        display_id: order.display_id,
        items: order.items,
        currency_code: order.currency_code,
        item_total: order.item_total,
        shipping_total: order.shipping_total,
        total: order.total,
        shipping_address: order.shipping_address,
      },
    })
  } catch (error) {
    logger.error(
      `order-placed subscriber: failed to send confirmation email for order ${data.id}`,
      error
    )
  }
}

export const config: SubscriberConfig = {
  event: OrderWorkflowEvents.PLACED,
  context: {
    subscriberId: "order-placed-handler",
  },
}
