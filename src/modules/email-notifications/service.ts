import {
  AbstractNotificationProviderService,
  MedusaError,
} from "@medusajs/framework/utils"
import type { Logger } from "@medusajs/framework/types"
import type {
  ProviderSendNotificationDTO,
  ProviderSendNotificationResultsDTO,
} from "@medusajs/framework/types"
import nodemailer, { Transporter } from "nodemailer"
import { orderTransferRequestedEmail } from "./templates/order-transfer-requested"
import { passwordResetEmail } from "./templates/password-reset"
import { orderPlacedEmail } from "./templates/order-placed"

type InjectedDependencies = {
  logger: Logger
}

export type EmailNotificationProviderOptions = {
  host: string
  port?: number
  secure?: boolean
  from: string
  auth?: {
    user: string
    pass: string
  }
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
 * Generic SMTP notification provider for the "email" channel, used since the
 * default "local" provider only supports the "feed" channel (it just logs).
 * Works with any SMTP account: Resend, SendGrid, Mailgun, Amazon SES, Gmail, etc.
 */
class EmailNotificationProviderService extends AbstractNotificationProviderService {
  static identifier = "email-notifications"

  protected logger_: Logger
  protected options_: EmailNotificationProviderOptions
  protected transporter_: Transporter

  constructor(
    { logger }: InjectedDependencies,
    options: EmailNotificationProviderOptions
  ) {
    super()

    this.logger_ = logger
    this.options_ = options
    this.transporter_ = nodemailer.createTransport({
      host: options.host,
      port: options.port ?? 587,
      secure: options.secure ?? false,
      auth: options.auth,
    })
  }

  static validateOptions(options: Record<string, unknown>) {
    if (!options.host) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "`host` is required in the email-notifications provider's options."
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

    await this.transporter_.sendMail({
      from: this.options_.from,
      to: notification.to,
      subject,
      html,
    })

    return {}
  }
}

export default EmailNotificationProviderService
