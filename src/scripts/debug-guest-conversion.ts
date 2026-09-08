import type { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

/**
 * Diagnostic for the guest -> registered conversion bug report: dumps every
 * Customer row, every AuthIdentity/provider_identity, and every Order whose
 * email matches the given one *case-insensitively*, so both a casing
 * mismatch and an order sitting on the wrong (or no) customer_id show up
 * directly instead of being silently missed by an exact-match query.
 *
 * Why this matters: verified in the installed Medusa (2.20.1) source —
 * provider_identity.entity_id (node_modules/@medusajs/auth/dist/models/
 * provider-identity.js) is a plain `text` column, and EmailPassAuthService
 * (node_modules/@medusajs/auth-emailpass/dist/services/emailpass.js) never
 * lowercases the email before using it as entity_id. The Customer module's
 * email *is* lowercased, but only on paths that call validateEmail() (e.g.
 * guest-checkout's find-or-create-customer step) — not on
 * POST /store/customers itself. So "BlueCells@gmail.com" typed once and
 * "bluecells@gmail.com" typed another time can end up as two entirely
 * distinct, case-sensitive-exact-match rows on the auth side.
 *
 * Run with:
 *   npx medusa exec ./src/scripts/debug-guest-conversion.ts <email>
 */
export default async function debugGuestConversion({ container, args }: ExecArgs) {
  const email = args[0]
  if (!email) {
    console.log("Usage: npx medusa exec ./src/scripts/debug-guest-conversion.ts <email>")
    return
  }
  const target = email.toLowerCase()

  const customerService = container.resolve(Modules.CUSTOMER)
  const authService = container.resolve(Modules.AUTH)
  const orderService = container.resolve(Modules.ORDER)

  console.log(`\n=== Customer rows matching "${email}" (case-insensitive) ===`)
  const allCustomers = await customerService.listCustomers(
    {},
    { select: ["id", "email", "has_account", "created_at", "deleted_at"], withDeleted: true, take: 5000 },
  )
  const customers = allCustomers.filter((c) => c.email?.toLowerCase() === target)
  if (!customers.length) {
    console.log("  (none)")
  }
  for (const c of customers) {
    const caseMismatch = c.email !== email ? "  <-- different case than queried" : "";
    console.log(
      `  id=${c.id} email="${c.email}" has_account=${c.has_account} deleted_at=${c.deleted_at ?? "-"}${caseMismatch}`,
    )
  }

  console.log(`\n=== AuthIdentity / provider_identity rows matching "${email}" (case-insensitive) ===`)
  const allIdentities = await authService.listAuthIdentities(
    {},
    { relations: ["provider_identities"], take: 5000 },
  )
  const matches = allIdentities.filter((identity) =>
    identity.provider_identities?.some((pi) => pi.entity_id?.toLowerCase() === target),
  )
  if (!matches.length) {
    console.log("  (none)")
  }
  for (const identity of matches) {
    console.log(`  auth_identity id=${identity.id}`)
    console.log(`    app_metadata=${JSON.stringify(identity.app_metadata)}`)
    for (const pi of identity.provider_identities ?? []) {
      if (pi.entity_id?.toLowerCase() !== target) continue
      const caseMismatch = pi.entity_id !== email ? "  <-- different case than queried" : "";
      console.log(
        `    provider_identity provider=${pi.provider} entity_id="${pi.entity_id}" has_password=${Boolean((pi.provider_metadata as Record<string, unknown> | undefined)?.password)}${caseMismatch}`,
      )
    }
  }

  // Order.email and Order.customer_id are two *independent* columns
  // (node_modules/@medusajs/order/dist/models/order.js) — an order can
  // have the right email and still have no customer_id (or the wrong
  // one), which is exactly what "order history is empty" looks like even
  // though the order genuinely has this email on it. GET /store/orders
  // filters by customer_id only, never by email, so this is the one place
  // that can reveal a real order sitting there unlinked.
  console.log(`\n=== Order rows with email matching "${email}" (case-insensitive) ===`)
  const allOrders = await orderService.listOrders(
    {},
    { select: ["id", "display_id", "email", "customer_id", "created_at"], take: 5000 },
  )
  const orders = allOrders.filter((o) => o.email?.toLowerCase() === target)
  if (!orders.length) {
    console.log("  (none)")
  }
  const customerIds = new Set(customers.map((c) => c.id))
  for (const o of orders) {
    const linked = o.customer_id
      ? customerIds.has(o.customer_id)
        ? ""
        : "  <-- customer_id does not match any Customer row listed above"
      : "  <-- customer_id is null, not linked to any customer"
    console.log(
      `  order #${o.display_id} id=${o.id} email="${o.email}" customer_id=${o.customer_id ?? "null"} created_at=${o.created_at}${linked}`,
    )
  }
  console.log("")
}
