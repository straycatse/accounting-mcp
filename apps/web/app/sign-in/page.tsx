"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { authClient } from "../../lib/auth-client";

function SignInForm() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const result =
        mode === "up"
          ? await authClient.signUp.email({ name: name || email, email, password })
          : await authClient.signIn.email({ email, password });
      if (result.error) {
        setError(result.error.message ?? "Authentication failed");
        return;
      }
      // Continue the OAuth authorization this login interrupted, if any
      // (MCP clients land here from the API's authorize endpoint).
      const qs = searchParams.toString();
      if (searchParams.has("client_id")) {
        window.location.href = `/api/auth/oauth2/authorize?${qs}`;
      } else {
        window.location.href = "/dashboard";
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1>{mode === "in" ? "Sign in" : "Sign up"}</h1>
      <p className="muted">Continue to authorize access to your accounting data.</p>
      <form onSubmit={submit}>
        {mode === "up" && (
          <label>
            Name <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </label>
        )}
        <label>
          Email{" "}
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </label>
        <label>
          Password{" "}
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "in" ? "current-password" : "new-password"}
          />
        </label>
        <button type="submit" disabled={busy}>
          {mode === "in" ? "Sign in" : "Sign up"}
        </button>
      </form>
      <p className="error">{error}</p>
      <p className="muted">
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setMode(mode === "in" ? "up" : "in");
          }}
        >
          {mode === "in" ? "No account? Sign up" : "Have an account? Sign in"}
        </a>
      </p>
    </>
  );
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}
