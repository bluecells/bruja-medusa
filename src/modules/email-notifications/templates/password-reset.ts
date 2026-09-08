type PasswordResetData = {
  url: string
}

export function passwordResetEmail(data: Record<string, unknown>) {
  const { url } = data as PasswordResetData

  return {
    subject: "Reimposta la tua password",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #111;">
        <h1 style="font-size: 20px;">Reimposta la tua password</h1>
        <p>
          Abbiamo ricevuto una richiesta di reimpostazione della password per il tuo account Bruja.bio.
        </p>
        <p>
          <a
            href="${url}"
            style="display:inline-block;padding:12px 20px;background:#111;color:#fff;text-decoration:none;border-radius:4px;"
          >
            Reimposta password
          </a>
        </p>
        <p style="color:#666;font-size:13px;">
          Questo link scade tra 15 minuti. Se non hai richiesto tu la reimpostazione, puoi ignorare questa email: la tua password resterà invariata.
        </p>
      </div>
    `,
  }
}
