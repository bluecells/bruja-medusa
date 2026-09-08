import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import {
  AuthWorkflowEvents,
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"

type PasswordResetEventData = {
  entity_id: string
  actor_type: string
  token: string
}

/**
 * Sends the "reset your password" email. Medusa's generate-reset-password-
 * token workflow (triggered by the storefront's requestPasswordReset(), see
 * bruja/src/lib/stores/customer.ts) only emits this event and issues the
 * token - it never sends anything itself, so without this subscriber the
 * reset link never reached anyone.
 *
 * Deliberately fires for any entity_id, even one with no account behind it
 * - that's Medusa's own anti-enumeration design (documented on the
 * storefront side, see requestPasswordReset()): entity_id here IS the email
 * the customer typed, whether or not it belongs to a real customer, so this
 * subscriber just relays it as-is rather than looking anything up first.
 *
 * Scoped to actor_type "customer" - the same workflow also backs
 * admin/staff password resets, which aren't this store's concern.
 */
export default async function passwordResetHandler({
  event: { data },
  container,
}: SubscriberArgs<PasswordResetEventData>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const notificationModuleService = container.resolve(Modules.NOTIFICATION)

  if (data.actor_type !== "customer") {
    return
  }

  const storefrontUrl = process.env.STOREFRONT_URL

  if (!storefrontUrl) {
    logger.warn(
      "password-reset subscriber: STOREFRONT_URL is not set, cannot build the reset link."
    )
    return
  }

  // Matches the URL ResetPasswordForm.tsx expects - see
  // bruja/src/pages/account/reset-password.astro.
  const resetUrl = new URL("/account/reset-password", storefrontUrl)
  resetUrl.searchParams.set("token", data.token)
  resetUrl.searchParams.set("email", data.entity_id)

  try {
    await notificationModuleService.createNotifications({
      to: data.entity_id,
      channel: "email",
      template: "password-reset",
      trigger_type: AuthWorkflowEvents.PASSWORD_RESET,
      resource_id: data.entity_id,
      data: {
        url: resetUrl.toString(),
      },
    })
  } catch (error) {
    logger.error(
      `password-reset subscriber: failed to send reset email to ${data.entity_id}`,
      error
    )
  }
}

export const config: SubscriberConfig = {
  event: AuthWorkflowEvents.PASSWORD_RESET,
  context: {
    subscriberId: "password-reset-handler",
  },
}
