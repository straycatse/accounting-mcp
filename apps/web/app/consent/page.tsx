"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

function ConsentForm() {
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const client = searchParams.get("client_name") ?? searchParams.get("client_id") ?? "unknown";
  const scopes = (searchParams.get("scope") ?? "").split(" ").filter(Boolean);

  async function respond(accept: boolean) {
    setBusy(true);
    try {
      const res = await fetch("/api/auth/oauth2/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ accept, oauth_query: window.location.search.slice(1) }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        redirect_uri?: string;
        url?: string;
        error_description?: string;
        message?: string;
        error?: string;
      };
      const target = data.redirect_uri ?? data.url;
      if (res.ok && target) {
        window.location.href = target;
      } else {
        setError(
          `${data.error_description ?? data.message ?? data.error ?? "Consent failed"} (HTTP ${res.status})`,
        );
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1>Authorize access</h1>
      <p>
        Application <code>{client}</code> is requesting access with scopes:
      </p>
      <ul>
        {scopes.length === 0 ? (
          <li className="muted">(default)</li>
        ) : (
          scopes.map((s) => (
            <li key={s}>
              <code>{s}</code>
            </li>
          ))
        )}
      </ul>
      <div className="row">
        <button onClick={() => respond(true)} disabled={busy}>
          Approve
        </button>
        <button onClick={() => respond(false)} disabled={busy}>
          Deny
        </button>
      </div>
      <p className="error">{error}</p>
    </>
  );
}

export default function ConsentPage() {
  return (
    <Suspense>
      <ConsentForm />
    </Suspense>
  );
}
