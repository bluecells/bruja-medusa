import { loadEnv, defineConfig } from "@medusajs/framework/utils"
loadEnv(process.env.NODE_ENV || "production", process.cwd())

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    workerMode: (process.env.MEDUSA_WORKER_MODE as
      | "shared"
      | "worker"
      | "server") || "shared",
    http: {
      storeCors: process.env.STORE_CORS || "",
      adminCors: process.env.ADMIN_CORS || "",
      authCors: process.env.AUTH_CORS || "",
      jwtSecret: process.env.JWT_SECRET || "supersecret",
      cookieSecret: process.env.COOKIE_SECRET || "supersecret",
    },
  },
  admin: {
    // Leave empty so the admin Vite bundle uses same-origin relative URLs.
    // Setting an absolute fallback (e.g. http://localhost:9000) gets baked into
    // the bundle at `medusa build` time and breaks production logins with
    // "Failed to fetch" (mixed-content / cross-origin).
    backendUrl: process.env.BACKEND_URL || "",
    disable: process.env.DISABLE_MEDUSA_ADMIN === "true",
  },
  modules: [
  { key: "api_key", resolve: "@medusajs/medusa/api-key" },
  {
      resolve: "@medusajs/medusa/file",
      options: {
        providers: [
          {
            resolve: "@medusajs/medusa/file-s3",
            id: "s3",
            options: {
              file_url: process.env.S3_FILE_URL,
              access_key_id: process.env.S3_ACCESS_KEY_ID,
              secret_access_key: process.env.S3_SECRET_ACCESS_KEY,
              region: process.env.S3_REGION,
              bucket: process.env.S3_BUCKET,
              endpoint: process.env.S3_ENDPOINT,
            },
          },
        ],
      },
    },
    {
      resolve: "@medusajs/medusa/payment",
      options: {
        providers: [
          {
            resolve: "@medusajs/payment-stripe",
            id: "stripe",
            options: {
              apiKey: process.env.STRIPE_API_KEY,
              webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
            },
          },
        ],
      },
    },
    {
      resolve: "@medusajs/medusa/notification",
      options: {
        providers: [
          // Keeps the admin activity "feed" (e.g. export/import progress) working -
          // this is the module's default provider, restated because declaring the
          // notification module here replaces its defaults entirely.
          {
            resolve: "@medusajs/medusa/notification-local",
            id: "local",
            options: {
              name: "Local Notification Provider",
              channels: ["feed"],
            },
          },
          // Sends real emails (e.g. the order-transfer-requested confirmation) via
          // any SMTP account - Resend, SendGrid, Mailgun, SES, Gmail, etc.
          {
            resolve: "./src/modules/email-notifications",
            id: "email-notifications",
            options: {
              channels: ["email"],
              host: process.env.SMTP_HOST,
              port: process.env.SMTP_PORT
                ? Number(process.env.SMTP_PORT)
                : undefined,
              secure: process.env.SMTP_SECURE === "true",
              from: process.env.SMTP_FROM,
              auth: process.env.SMTP_USER
                ? {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASSWORD,
                  }
                : undefined,
            },
          },
        ],
      },
    },
  ],
})

