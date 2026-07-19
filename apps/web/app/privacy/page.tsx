export const metadata = { title: "Privacy policy — accounting-mcp" };

export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy policy</h1>
      <ul>
        <li>
          We store your email, password hash, and the OAuth tokens needed to reach your accounting
          provider. Provider tokens are encrypted at rest (AES-256-GCM).
        </li>
        <li>
          Accounting data is fetched from your provider on demand when you (via your AI assistant)
          request it, and passed through to your assistant. We do not store, resell, or use your
          accounting data for any other purpose, including training.
        </li>
        <li>
          A minimal audit log of tool activity (tool name, timestamp, success) is kept for security
          and support.
        </li>
        <li>Payments are processed by Stripe; we never see your card details.</li>
        <li>
          Disconnecting a company or deleting your account removes the stored tokens. Data
          controller: Stray Cat AB — contact{" "}
          <a href="mailto:simon@straycat.se">simon@straycat.se</a> for access or deletion requests
          (GDPR).
        </li>
      </ul>
      <p className="muted">
        <em>Svenska:</em> Vi lagrar endast det som krävs för att koppla din bokföring till din
        AI-assistent. Tokens krypteras, bokföringsdata vidarebefordras bara på din begäran och säljs
        aldrig vidare. Kontakta simon@straycat.se för registerutdrag eller radering.
      </p>
    </>
  );
}
