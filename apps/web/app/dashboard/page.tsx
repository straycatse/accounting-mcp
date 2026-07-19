"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authClient } from "../../lib/auth-client";
import { useTRPC } from "../../lib/trpc";

const mcpUrl = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"}/mcp`;

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

function ConnectorCards() {
  return (
    <>
      <h2>Connect your AI assistant</h2>
      <p className="muted">
        Add this server as a custom connector (MCP) — sign-in happens in the browser when the
        assistant first connects:
      </p>
      <div className="copy-row">
        <code>{mcpUrl}</code>
        <CopyButton text={mcpUrl} />
      </div>
      <div className="card">
        <h3>Claude</h3>
        <p>
          Settings → Connectors → <em>Add custom connector</em>, paste the URL above.
        </p>
        <a href="https://claude.ai/settings/connectors" target="_blank" rel="noopener">
          <button>Open Claude settings</button>
        </a>
        <p className="muted">Claude Code:</p>
        <div className="copy-row">
          <code>claude mcp add --transport http accounting {mcpUrl}</code>
          <CopyButton text={`claude mcp add --transport http accounting ${mcpUrl}`} />
        </div>
      </div>
      <div className="card">
        <h3>ChatGPT</h3>
        <p>
          Requires developer mode (Pro/Team/Enterprise): Settings → Connectors →{" "}
          <em>Advanced settings</em> → enable <em>Developer mode</em>, then <em>Create</em> a
          connector with the URL above.
        </p>
        <a href="https://chatgpt.com/#settings/Connectors" target="_blank" rel="noopener">
          <button>Open ChatGPT settings</button>
        </a>
      </div>
      <div className="card">
        <h3>Perplexity</h3>
        <p>
          Settings → Connectors → <em>Add connector</em> → Remote, paste the URL above and choose
          OAuth authentication.
        </p>
        <a
          href="https://www.perplexity.ai/help-center/en/articles/13915507-adding-custom-remote-connectors"
          target="_blank"
          rel="noopener"
        >
          <button>Open Perplexity guide</button>
        </a>
      </div>
      <div className="card">
        <h3>Gemini</h3>
        <p>The Gemini web app doesn&apos;t support custom MCP connectors yet — use Gemini CLI:</p>
        <div className="copy-row">
          <code>gemini mcp add --transport http accounting {mcpUrl}</code>
          <CopyButton text={`gemini mcp add --transport http accounting ${mcpUrl}`} />
        </div>
      </div>
    </>
  );
}

function Dashboard() {
  const searchParams = useSearchParams();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const billing = useQuery(trpc.billing.get.queryOptions());
  const connections = useQuery(trpc.connections.list.queryOptions());

  const [piToken, setPiToken] = useState("");
  const [piCompany, setPiCompany] = useState("");
  const [piError, setPiError] = useState("");
  const [billingError, setBillingError] = useState("");

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: trpc.billing.get.queryKey() });
    void queryClient.invalidateQueries({ queryKey: trpc.connections.list.queryKey() });
  };

  const disconnect = useMutation(
    trpc.connections.disconnect.mutationOptions({
      onSuccess: refresh,
      onError: (err) => alert(`Could not remove: ${err.message}`),
    }),
  );

  const tokenConnect = useMutation(
    trpc.connections.connectViaToken.mutationOptions({
      onSuccess: () => {
        setPiToken("");
        setPiCompany("");
        setPiError("");
        refresh();
      },
      onError: (err) => setPiError(err.message),
    }),
  );

  async function billingAction(action: "subscribe" | "portal", seats?: number) {
    setBillingError("");
    const returnTo = `${window.location.origin}/dashboard`;
    const result =
      action === "subscribe"
        ? await authClient.subscription.upgrade({
            plan: "standard",
            seats,
            successUrl: returnTo,
            cancelUrl: returnTo,
          })
        : await authClient.subscription.billingPortal({ returnUrl: returnTo });
    if (result.error) {
      setBillingError(result.error.message ?? "Billing request failed");
    } else if (result.data && "url" in result.data && typeof result.data.url === "string") {
      window.location.href = result.data.url;
    }
  }

  const b = billing.data;
  const banner =
    searchParams.get("billing") === "required"
      ? "Start your free trial before connecting a company."
      : searchParams.get("billing") === "seats"
        ? "That company would need another seat — add one to your subscription first."
        : "";

  // Connecting is gated server-side too; this only mirrors it in the UI.
  const canConnect = b?.canConnect ?? true;
  const connectHint = b && !b.canConnect
    ? b.subscriptionStatus
      ? `All ${b.seats} ${b.seats === 1 ? "seat is" : "seats are"} in use — add a company to your subscription to connect another.`
      : "Start your free trial to connect a company."
    : "";

  const trialDaysLeft =
    b?.trialing && b.trialEnd
      ? Math.ceil((new Date(b.trialEnd).getTime() - Date.now()) / 86400000)
      : null;

  return (
    <>
      <p className="error">{banner}</p>

      {b?.billingEnabled && (
        <div>
          <h2>Subscription</h2>
          <p className="muted">
            {b.complimentary
              ? "Complimentary account — no subscription needed."
              : b.subscriptionStatus
                ? trialDaysLeft !== null
                  ? `Free trial — ${trialDaysLeft} ${trialDaysLeft === 1 ? "day" : "days"} left. Add a payment method before it ends to continue with ${b.seats} ${b.seats === 1 ? "company" : "companies"}; otherwise the subscription simply ends.`
                  : `Subscribed — ${b.seats} ${b.seats === 1 ? "company" : "companies"} (status: ${b.subscriptionStatus}).`
                : "Start with a free trial — no card required. Add a payment method before it ends to keep your companies connected."}
          </p>
          <div className="row">
            {!b.complimentary && !b.subscriptionStatus && (
              <button onClick={() => void billingAction("subscribe", 1)}>Start free trial</button>
            )}
            {!b.complimentary && b.subscriptionStatus && !b.canConnect && (
              <button
                onClick={() => void billingAction("subscribe", b.activeConnections + 1)}
              >
                Add a company ({b.activeConnections + 1} total)
              </button>
            )}
            {!b.complimentary && b.subscriptionStatus && (
              <button onClick={() => void billingAction("portal")}>Manage billing</button>
            )}
          </div>
          <p className="error">{billingError}</p>
        </div>
      )}

      <h2>Connected companies</h2>
      <ul>
        {!connections.data || connections.data.length === 0 ? (
          <li className="muted">None yet.</li>
        ) : (
          connections.data.map((conn) => (
            <li key={conn.id}>
              <span>
                {conn.companyName ?? conn.tenantId} —{" "}
                {conn.authType === "integration_token" ? "private token" : "oauth"} ({conn.status}){" "}
              </span>
              <button
                className="remove-btn"
                disabled={disconnect.isPending}
                onClick={() => {
                  if (confirm(`Remove ${conn.companyName ?? conn.tenantId}?`)) {
                    disconnect.mutate({ id: conn.id });
                  }
                }}
              >
                Remove
              </button>
            </li>
          ))
        )}
      </ul>

      <div className="card">
        <h3>Connect via Bokio (OAuth)</h3>
        <p className="muted">
          Authorize in Bokio&apos;s own consent screen. Requires our public Bokio app — available
          once approved on the Bokio marketplace.
        </p>
        <button
          disabled={!canConnect}
          onClick={() => {
            window.location.href = "/connect/bokio";
          }}
        >
          Connect a Bokio company
        </button>
        {connectHint && <p className="muted">{connectHint}</p>}
      </div>

      <div className="card">
        <h3>Connect with a private integration token</h3>
        <p className="muted">
          Works today with your own company — no marketplace review. In Bokio:{" "}
          <em>Settings → API Tokens → Create Private Integration</em>, then paste the token and your
          company ID (the GUID in your Bokio URL) below.
        </p>
        <label>
          Integration token{" "}
          <input
            type="password"
            autoComplete="off"
            value={piToken}
            onChange={(e) => setPiToken(e.target.value)}
          />
        </label>
        <label>
          Company ID{" "}
          <input
            autoComplete="off"
            placeholder="00000000-0000-0000-0000-000000000000"
            value={piCompany}
            onChange={(e) => setPiCompany(e.target.value)}
          />
        </label>
        <button
          disabled={tokenConnect.isPending}
          onClick={() => {
            if (!piToken.trim() || !piCompany.trim()) {
              setPiError("Enter both the integration token and the company ID.");
              return;
            }
            setPiError("");
            tokenConnect.mutate({ integrationToken: piToken.trim(), companyId: piCompany.trim() });
          }}
        >
          Connect with token
        </button>
        <p className="error">{piError}</p>
      </div>

      <ConnectorCards />
    </>
  );
}

function DashboardGate() {
  const session = authClient.useSession();

  if (session.isPending) {
    return <p className="muted">Checking session…</p>;
  }
  if (!session.data?.user) {
    window.location.href = "/sign-in";
    return null;
  }
  return (
    <>
      <p className="muted">Signed in as {session.data.user.email}</p>
      <Dashboard />
    </>
  );
}

export default function DashboardPage() {
  return (
    <>
      <h1>accounting-mcp</h1>
      <Suspense>
        <DashboardGate />
      </Suspense>
    </>
  );
}
