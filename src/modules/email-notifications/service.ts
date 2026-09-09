import {
  AbstractNotificationProviderService,
  MedusaError,
} from "@medusajs/framework/utils"
import type { Logger } from "@medusajs/framework/types"
import type {
  ProviderSendNotificationDTO,
  ProviderSendNotificationResultsDTO,
} from "@medusajs/framework/types"
import { orderTransferRequestedEmail } from "./templates/order-transfer-requested"
import { passwordResetEmail } from "./templates/password-reset"
import { orderPlacedEmail } from "./templates/order-placed"

type InjectedDependencies = {
  logger: Logger
}

export type EmailNotificationProviderOptions = {
  apiKey: string
  from: string
}

type EmailTemplateFn = (data: Record<string, unknown>) => {
  subject: string
  html: string
}

// Add new email templates here, keyed by the `template` name passed to
// notificationModuleService.createNotifications(...).
const templates: Record<string, EmailTemplateFn> = {
  "order-transfer-requested": orderTransferRequestedEmail,
  "password-reset": passwordResetEmail,
  "order-placed": orderPlacedEmail,
}

/**
 * Sends email via the Resend HTTP API (not SMTP). Railway blocks outbound
 * SMTP ports (465/587): confirmed by testing from inside the deployed
 * container, where a raw TCP connect to smtp.resend.com hangs until timeout
 * while HTTPS connects instantly. The HTTP API only needs port 443, so it
 * works from Railway - SMTP silently never will.
 */
class EmailNotificationProviderService extends AbstractNotificationProviderService {
  static identifier = "email-notifications"

  protected logger_: Logger
  protected options_: EmailNotificationProviderOptions

  constructor(
    { logger }: InjectedDependencies,
    options: EmailNotificationProviderOptions
  ) {
    super()

    this.logger_ = logger
    this.options_ = options
  }

  static validateOptions(options: Record<string, unknown>) {
    if (!options.apiKey) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "`apiKey` is required in the email-notifications provider's options."
      )
    }
    if (!options.from) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "`from` is required in the email-notifications provider's options."
      )
    }
  }

  async send(
    notification: ProviderSendNotificationDTO
  ): Promise<ProviderSendNotificationResultsDTO> {
    const templateFn = templates[notification.template]

    if (!templateFn) {
      this.logger_.warn(
        `email-notifications: no template registered for "${notification.template}", skipping.`
      )
      return {}
    }

    const { subject, html } = templateFn(notification.data ?? {})

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.options_.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: this.options_.from,
        to: notification.to,
        subject,
        html,
      }),
    })

    if (!response.ok) {
      const body = await response.text().catch(() => "")
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Resend API responded with ${response.status}: ${body}`
      )
    }

    const result = (await response.json()) as { id?: string }

    return { id: result.id }
  }
}

export default EmailNotificationProviderService
