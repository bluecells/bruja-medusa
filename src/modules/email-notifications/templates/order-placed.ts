type OrderPlacedItem = {
  title: string
  quantity: number
  unit_price: number
}

type OrderPlacedData = {
  display_id?: number
  items: OrderPlacedItem[]
  currency_code: string
  item_total: number
  shipping_total: number
  total: number
  shipping_address?: {
    first_name?: string | null
    last_name?: string | null
    address_1?: string | null
    postal_code?: string | null
    city?: string | null
    country_code?: string | null
  } | null
}

function formatMoney(amount: number, currencyCode: string): string {
  try {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: currencyCode.toUpperCase(),
    }).format(amount)
  } catch {
    // Unknown/invalid currency code — fall back to a plain number rather
    // than letting Intl throw and losing the whole email.
    return `${amount.toFixed(2)} ${currencyCode.toUpperCase()}`
  }
}

export function orderPlacedEmail(data: Record<string, unknown>) {
  const {
    display_id,
    items,
    currency_code,
    item_total,
    shipping_total,
    total,
    shipping_address,
  } = data as OrderPlacedData

  const itemsRows = (items ?? [])
    .map(
      (item) => `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #eee;">
            ${item.title}${item.quantity > 1 ? ` &times; ${item.quantity}` : ""}
          </td>
          <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;white-space:nowrap;">
            ${formatMoney(item.unit_price * item.quantity, currency_code)}
          </td>
        </tr>
      `,
    )
    .join("")

  const shippingLine =
    shipping_address?.address_1 && shipping_address?.city
      ? `
        <p style="color:#666;font-size:13px;">
          Spedizione a: ${[shipping_address.first_name, shipping_address.last_name].filter(Boolean).join(" ")}<br/>
          ${shipping_address.address_1}, ${shipping_address.postal_code ?? ""} ${shipping_address.city}
          ${shipping_address.country_code ? ` (${shipping_address.country_code.toUpperCase()})` : ""}
        </p>
      `
      : ""

  return {
    subject: `Conferma d'ordine${display_id ? ` #${display_id}` : ""}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #111;">
        <h1 style="font-size: 20px;">Grazie per il tuo ordine${display_id ? ` #${display_id}` : ""}!</h1>
        <p>Abbiamo ricevuto il tuo ordine e lo stiamo preparando.</p>

        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tbody>
            ${itemsRows}
          </tbody>
        </table>

        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tbody>
            <tr>
              <td style="padding:2px 0;color:#666;">Subtotale</td>
              <td style="padding:2px 0;text-align:right;">${formatMoney(item_total, currency_code)}</td>
            </tr>
            <tr>
              <td style="padding:2px 0;color:#666;">Spedizione</td>
              <td style="padding:2px 0;text-align:right;">${formatMoney(shipping_total, currency_code)}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;font-weight:bold;border-top:1px solid #ddd;">Totale</td>
              <td style="padding:6px 0;text-align:right;font-weight:bold;border-top:1px solid #ddd;">${formatMoney(total, currency_code)}</td>
            </tr>
          </tbody>
        </table>

        ${shippingLine}
      </div>
    `,
  }
}
