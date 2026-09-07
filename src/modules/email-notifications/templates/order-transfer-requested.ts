type OrderTransferRequestedData = {
  url: string
  order_id?: string
}

export function orderTransferRequestedEmail(data: Record<string, unknown>) {
  const { url, order_id } = data as OrderTransferRequestedData

  return {
    subject: "Confirmez le rattachement de votre commande",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #111;">
        <h1 style="font-size: 20px;">Rattacher votre commande à votre compte</h1>
        <p>
          Vous avez demandé à rattacher la commande${
            order_id ? ` <strong>${order_id}</strong>` : ""
          } à l'historique de votre compte.
        </p>
        <p>
          <a
            href="${url}"
            style="display:inline-block;padding:12px 20px;background:#111;color:#fff;text-decoration:none;border-radius:4px;"
          >
            Confirmer le rattachement
          </a>
        </p>
        <p style="color:#666;font-size:13px;">
          Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email.
        </p>
      </div>
    `,
  }
}
